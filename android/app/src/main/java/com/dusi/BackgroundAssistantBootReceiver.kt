package com.dusi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BackgroundAssistantBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action.orEmpty()
        val shouldStart = action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED
        if (!shouldStart) {
            return
        }

        if (!BackgroundAssistantPrefs.isEnabled(context)) {
            return
        }

        val startIntent = Intent(context, BackgroundAssistantService::class.java).apply {
            this.action = BackgroundAssistantService.ACTION_START
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(startIntent)
        } else {
            context.startService(startIntent)
        }
    }
}
