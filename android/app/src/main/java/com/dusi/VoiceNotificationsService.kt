package com.dusi

import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.Locale

class VoiceNotificationsService : NotificationListenerService(), TextToSpeech.OnInitListener {

    companion object {
        const val ACTION_STOP_SPEECH = "com.dusi.action.STOP_VOICE_NOTIFICATION_SPEECH"
    }

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var lastMessage = ""
    private var lastSpokenAt = 0L

    override fun onCreate() {
        super.onCreate()
        tts = TextToSpeech(this, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true
            tts?.language = Locale("ru", "RU")
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!VoiceNotificationsPrefs.isEnabled(this)) {
            tts?.stop()
            return
        }

        val packageName = sbn.packageName ?: return
        val mode = VoiceNotificationsPrefs.getMode(this)
        if (mode == "selected") {
            val selected = VoiceNotificationsPrefs.getSelectedPackages(this)
            if (!selected.contains(packageName)) {
                return
            }
        }

        val extras = sbn.notification?.extras ?: Bundle.EMPTY
        val title = extras.getCharSequence("android.title")?.toString()?.trim().orEmpty()
        val text = extras.getCharSequence("android.text")?.toString()?.trim().orEmpty()
        val bigText = extras.getCharSequence("android.bigText")?.toString()?.trim().orEmpty()

        val spokenBody = when {
            bigText.isNotEmpty() -> bigText
            text.isNotEmpty() -> text
            else -> ""
        }

        if (title.isEmpty() && spokenBody.isEmpty()) {
            return
        }

        val appLabel = getAppLabel(packageName)
        val message = buildString {
            append("Уведомление")
            if (appLabel.isNotEmpty()) {
                append(" от ")
                append(appLabel)
            }
            append(".")
            if (title.isNotEmpty()) {
                append(" ")
                append(title)
                append(".")
            }
            if (spokenBody.isNotEmpty()) {
                append(" ")
                append(spokenBody)
            }
        }.trim()

        val now = System.currentTimeMillis()
        if (message == lastMessage && now - lastSpokenAt < 1500) {
            return
        }
        lastMessage = message
        lastSpokenAt = now

        speak(message)
    }

    override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SPEECH) {
            tts?.stop()
            return START_NOT_STICKY
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun getAppLabel(packageName: String): String {
        return try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(appInfo)?.toString().orEmpty()
        } catch (_: Exception) {
            packageName
        }
    }

    private fun speak(message: String) {
        if (!ttsReady || message.isBlank()) {
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            tts?.speak(message, TextToSpeech.QUEUE_FLUSH, null, "notif-${System.currentTimeMillis()}")
        } else {
            @Suppress("DEPRECATION")
            tts?.speak(message, TextToSpeech.QUEUE_FLUSH, null)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        ttsReady = false
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
