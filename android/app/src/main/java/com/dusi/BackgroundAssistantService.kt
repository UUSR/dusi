package com.dusi

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.util.Locale
import java.util.ArrayList
import java.util.concurrent.atomic.AtomicBoolean
import android.util.Log

class BackgroundAssistantService : Service() {

    companion object {
        const val ACTION_START = "com.dusi.action.BG_ASSISTANT_START"
        const val ACTION_STOP = "com.dusi.action.BG_ASSISTANT_STOP"
        const val ACTION_REFRESH_NOTIFICATION = "com.dusi.action.BG_ASSISTANT_REFRESH_NOTIFICATION"

        private const val CHANNEL_ID = "dusi_bg_assistant"
        private const val NOTIFICATION_ID = 22041

        private val running = AtomicBoolean(false)

        fun isRunning(): Boolean = running.get()
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var restartScheduled = false
    private var lastEmittedAt = 0L
    private var lastEmittedPhrase = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                BackgroundAssistantPrefs.setEnabled(this, false)
                BackgroundAssistantBridge.emitState(enabled = false, running = false)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_REFRESH_NOTIFICATION -> {
                updateNotification(buildIdleNotificationText())
            }
            ACTION_START, null -> {
                startForegroundCompat()
                startRecognition()
            }
            else -> {
                // Ignore unknown actions.
            }
        }

        return START_STICKY
    }

    override fun onCreate() {
        super.onCreate()
        running.set(true)
        BackgroundAssistantBridge.emitState(
            enabled = BackgroundAssistantPrefs.isEnabled(this),
            running = true,
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        running.set(false)
        BackgroundAssistantBridge.emitState(
            enabled = BackgroundAssistantPrefs.isEnabled(this),
            running = false,
        )
        cancelRestart()
        stopRecognitionInternal()
    }

    private fun startForegroundCompat() {
        ensureNotificationChannel()
        val notification = buildNotification(buildIdleNotificationText())
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun buildIdleNotificationText(): String {
        return "Фоновое распознавание активно. ${buildConfigSummary()}"
    }

    private fun buildListeningNotificationText(): String {
        return "Слушаю команду. ${buildConfigSummary()}"
    }

    private fun buildConfigSummary(): String {
        val requireWakeWord = BackgroundAssistantPrefs.isWakeWordRequired(this)
        val wakeWord = BackgroundAssistantPrefs.getWakeWord(this)
        val cooldownMs = BackgroundAssistantPrefs.getCooldownMs(this)

        val wakeWordPart = if (requireWakeWord) {
            "Ключевое слово: $wakeWord"
        } else {
            "Без ключевого слова"
        }

        val cooldownPart = "Интервал: ${String.format(Locale.US, "%.1f", cooldownMs / 1000.0)} c"
        return "$wakeWordPart. $cooldownPart"
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Фоновый ассистент",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Нужен для непрерывной работы голосового ассистента"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(contentText: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag(),
        )

        val stopIntent = Intent(this, BackgroundAssistantService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag(),
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Dusi: фоновый ассистент")
            .setContentText(contentText)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, "Остановить", stopPendingIntent)
            .build()
    }

    private fun pendingIntentImmutableFlag(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE
        } else {
            0
        }
    }

    private fun startRecognition() {
        if (isListening) {
            Log.w("BackgroundAssistantService", "Recognition already active, skipping start.")
            return
        }

        val requireWakeWord = BackgroundAssistantPrefs.isWakeWordRequired(this)
        if (!requireWakeWord) {
            Log.i("BackgroundAssistantService", "Wake word not required, skipping recognition start.")
            return
        }

        Log.i("BackgroundAssistantService", "Starting recognition with wake word.")
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            stopSelf()
            return
        }

        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
            speechRecognizer?.setRecognitionListener(recognitionListener)
        }

        val recognizerIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, packageName)
        }

        try {
            isListening = true
            speechRecognizer?.startListening(recognizerIntent)
            updateNotification(buildListeningNotificationText())
        } catch (_: Exception) {
            isListening = false
            scheduleRestart(1200L)
        }
    }

    private fun stopRecognitionInternal() {
        if (!isListening) {
            Log.w("BackgroundAssistantService", "Recognition already stopped, skipping stop.")
            return
        }

        Log.i("BackgroundAssistantService", "Stopping recognition.")
        try {
            speechRecognizer?.cancel()
        } catch (_: Exception) {
            // Ignore cleanup exception.
        }
        try {
            speechRecognizer?.destroy()
        } catch (_: Exception) {
            // Ignore cleanup exception.
        }
        speechRecognizer = null
    }

    private fun scheduleRestart(delayMs: Long) {
        if (restartScheduled) {
            return
        }

        restartScheduled = true
        mainHandler.postDelayed({
            restartScheduled = false
            startRecognition()
        }, delayMs)
    }

    private fun cancelRestart() {
        restartScheduled = false
        mainHandler.removeCallbacksAndMessages(null)
    }

    private fun updateNotification(contentText: String) {
        val manager = ContextCompat.getSystemService(this, NotificationManager::class.java) ?: return
        manager.notify(NOTIFICATION_ID, buildNotification(contentText))
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: android.os.Bundle?) {
            // No-op.
        }

        override fun onBeginningOfSpeech() {
            // No-op.
        }

        override fun onRmsChanged(rmsdB: Float) {
            // No-op.
        }

        override fun onBufferReceived(buffer: ByteArray?) {
            // No-op.
        }

        override fun onEndOfSpeech() {
            isListening = false
        }

        override fun onError(error: Int) {
            isListening = false
            val delay = if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                500L
            } else {
                1500L
            }
            scheduleRestart(delay)
        }

        override fun onResults(results: android.os.Bundle?) {
            isListening = false

            val matches = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?: ArrayList()
            val phrase = matches.firstOrNull()?.trim().orEmpty()

            if (phrase.isNotEmpty()) {
                val processedPhrase = processRecognizedPhrase(phrase)
                if (processedPhrase != null) {
                    BackgroundAssistantBridge.emitPhrase(processedPhrase)
                    updateNotification("Распознано: $processedPhrase. ${buildConfigSummary()}")
                } else {
                    updateNotification(buildIdleNotificationText())
                }
            }

            scheduleRestart(700L)
        }

        override fun onPartialResults(partialResults: android.os.Bundle?) {
            // No-op.
        }

        override fun onEvent(eventType: Int, params: android.os.Bundle?) {
            // No-op.
        }
    }

    private fun processRecognizedPhrase(rawPhrase: String): String? {
        val phrase = rawPhrase.trim()
        if (phrase.isEmpty()) {
            return null
        }

        val requireWakeWord = BackgroundAssistantPrefs.isWakeWordRequired(this)
        val wakeWord = BackgroundAssistantPrefs.getWakeWord(this)

        if (requireWakeWord) {
            if (!containsWakeWord(phrase, wakeWord)) {
                return null
            }
        }

        val command = if (requireWakeWord) {
            extractCommandAfterWakeWord(phrase, wakeWord)
        } else {
            phrase
        }

        if (command.isBlank()) {
            return null
        }

        if (isThrottled(command)) {
            return null
        }

        return command
    }

    private fun isThrottled(phrase: String): Boolean {
        val now = System.currentTimeMillis()
        val cooldownMs = BackgroundAssistantPrefs.getCooldownMs(this).toLong()
        val normalized = normalizeForMatch(phrase)

        if (now - lastEmittedAt < cooldownMs) {
            return true
        }

        if (normalized.isNotEmpty() && normalized == lastEmittedPhrase && now - lastEmittedAt < cooldownMs * 2) {
            return true
        }

        lastEmittedAt = now
        lastEmittedPhrase = normalized
        return false
    }

    private fun containsWakeWord(phrase: String, wakeWord: String): Boolean {
        val normalizedPhrase = " ${normalizeForMatch(phrase)} "
        val normalizedWakeWord = normalizeForMatch(wakeWord)
        if (normalizedWakeWord.isEmpty()) {
            return false
        }

        return normalizedPhrase.contains(" $normalizedWakeWord ")
    }

    private fun extractCommandAfterWakeWord(phrase: String, wakeWord: String): String {
        val loweredPhrase = phrase.lowercase(Locale.getDefault())
        val loweredWakeWord = wakeWord.trim().lowercase(Locale.getDefault())

        if (loweredWakeWord.isEmpty()) {
            return ""
        }

        val index = loweredPhrase.indexOf(loweredWakeWord)
        if (index < 0) {
            return ""
        }

        val afterWakeWord = phrase
            .substring((index + loweredWakeWord.length).coerceAtMost(phrase.length))
            .trim { it <= ' ' || it in ",.!?:;" }

        return afterWakeWord
    }

    private fun normalizeForMatch(value: String): String {
        return value
            .trim()
            .lowercase(Locale.getDefault())
            .replace('ё', 'е')
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
