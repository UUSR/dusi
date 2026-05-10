package com.dusi

import android.content.Context

private const val PREFS_NAME = "voice_notifications_prefs"
private const val KEY_ENABLED = "enabled"
private const val KEY_MODE = "mode"
private const val KEY_SELECTED_PACKAGES = "selected_packages"

object VoiceNotificationsPrefs {
    private const val MODE_ALL = "all"
    private const val MODE_SELECTED = "selected"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    fun setEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    fun getMode(context: Context): String {
        val mode = prefs(context).getString(KEY_MODE, MODE_ALL) ?: MODE_ALL
        return if (mode == MODE_SELECTED) MODE_SELECTED else MODE_ALL
    }

    fun setMode(context: Context, mode: String) {
        val safeMode = if (mode == MODE_SELECTED) MODE_SELECTED else MODE_ALL
        prefs(context).edit().putString(KEY_MODE, safeMode).apply()
    }

    fun getSelectedPackages(context: Context): Set<String> =
        prefs(context).getStringSet(KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()

    fun setSelectedPackages(context: Context, packages: Set<String>) {
        prefs(context).edit().putStringSet(KEY_SELECTED_PACKAGES, packages).apply()
    }
}
