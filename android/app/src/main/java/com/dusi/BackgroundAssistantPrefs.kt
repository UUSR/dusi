package com.dusi

import android.content.Context

private const val BG_ASSISTANT_PREFS = "background_assistant_prefs"
private const val KEY_ENABLED = "enabled"
private const val KEY_REQUIRE_WAKE_WORD = "require_wake_word"
private const val KEY_WAKE_WORD = "wake_word"
private const val KEY_COOLDOWN_MS = "cooldown_ms"

private const val DEFAULT_WAKE_WORD = "дуся"
private const val DEFAULT_COOLDOWN_MS = 2500

object BackgroundAssistantPrefs {
    private fun prefs(context: Context) =
        context.getSharedPreferences(BG_ASSISTANT_PREFS, Context.MODE_PRIVATE)

    fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun isWakeWordRequired(context: Context): Boolean =
        prefs(context).getBoolean(KEY_REQUIRE_WAKE_WORD, true)

    fun setWakeWordRequired(context: Context, required: Boolean) {
        prefs(context).edit().putBoolean(KEY_REQUIRE_WAKE_WORD, required).apply()
    }

    fun getWakeWord(context: Context): String {
        val stored = prefs(context).getString(KEY_WAKE_WORD, DEFAULT_WAKE_WORD).orEmpty().trim()
        return if (stored.isEmpty()) DEFAULT_WAKE_WORD else stored
    }

    fun setWakeWord(context: Context, wakeWord: String) {
        val safeWakeWord = wakeWord.trim().ifEmpty { DEFAULT_WAKE_WORD }
        prefs(context).edit().putString(KEY_WAKE_WORD, safeWakeWord).apply()
    }

    fun getCooldownMs(context: Context): Int {
        val value = prefs(context).getInt(KEY_COOLDOWN_MS, DEFAULT_COOLDOWN_MS)
        return value.coerceIn(500, 10000)
    }

    fun setCooldownMs(context: Context, cooldownMs: Int) {
        val safeValue = cooldownMs.coerceIn(500, 10000)
        prefs(context).edit().putInt(KEY_COOLDOWN_MS, safeValue).apply()
    }
}
