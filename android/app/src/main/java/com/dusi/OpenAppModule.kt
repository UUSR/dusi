package com.dusi

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OpenAppModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OpenApp"

    @ReactMethod
    fun open(packageName: String, promise: Promise) {
        try {
            val normalized = packageName.trim()
            if (normalized.isEmpty()) {
                promise.reject("INVALID_PACKAGE", "Пустое имя пакета")
                return
            }

            val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(normalized)
            if (launchIntent == null) {
                promise.reject("APP_NOT_FOUND", "Приложение не найдено: $normalized")
                return
            }

            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(launchIntent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("OPEN_APP_FAILED", e.message ?: "Не удалось открыть приложение", e)
        }
    }
}
