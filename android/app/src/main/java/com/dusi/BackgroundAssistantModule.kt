package com.dusi

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BackgroundAssistantModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BackgroundAssistant"

    init {
        BackgroundAssistantBridge.attachReactContext(reactContext)
    }

    @ReactMethod
    fun start(promise: Promise) {
        try {
            BackgroundAssistantPrefs.setEnabled(reactContext, true)
            BackgroundAssistantBridge.emitState(enabled = true, running = true)
            val intent = Intent(reactContext, BackgroundAssistantService::class.java).apply {
                action = BackgroundAssistantService.ACTION_START
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("BG_ASSISTANT_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            BackgroundAssistantPrefs.setEnabled(reactContext, false)
            BackgroundAssistantBridge.emitState(enabled = false, running = false)
            val stopIntent = Intent(reactContext, BackgroundAssistantService::class.java).apply {
                action = BackgroundAssistantService.ACTION_STOP
            }
            reactContext.startService(stopIntent)
            reactContext.stopService(Intent(reactContext, BackgroundAssistantService::class.java))
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("BG_ASSISTANT_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(BackgroundAssistantService.isRunning())
    }

    @ReactMethod
    fun getConfig(promise: Promise) {
        try {
            val map = Arguments.createMap()
            map.putBoolean("enabled", BackgroundAssistantPrefs.isEnabled(reactContext))
            map.putBoolean("running", BackgroundAssistantService.isRunning())
            map.putBoolean("requireWakeWord", BackgroundAssistantPrefs.isWakeWordRequired(reactContext))
            map.putString("wakeWord", BackgroundAssistantPrefs.getWakeWord(reactContext))
            map.putInt("cooldownMs", BackgroundAssistantPrefs.getCooldownMs(reactContext))
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("BG_ASSISTANT_CONFIG_GET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setConfig(config: ReadableMap, promise: Promise) {
        try {
            if (config.hasKey("requireWakeWord") && !config.isNull("requireWakeWord")) {
                BackgroundAssistantPrefs.setWakeWordRequired(
                    reactContext,
                    config.getBoolean("requireWakeWord"),
                )
            }

            if (config.hasKey("wakeWord") && !config.isNull("wakeWord")) {
                BackgroundAssistantPrefs.setWakeWord(
                    reactContext,
                    config.getString("wakeWord").orEmpty(),
                )
            }

            if (config.hasKey("cooldownMs") && !config.isNull("cooldownMs")) {
                BackgroundAssistantPrefs.setCooldownMs(
                    reactContext,
                    config.getInt("cooldownMs"),
                )
            }

            if (BackgroundAssistantService.isRunning()) {
                val refreshIntent = Intent(reactContext, BackgroundAssistantService::class.java).apply {
                    action = BackgroundAssistantService.ACTION_REFRESH_NOTIFICATION
                }
                reactContext.startService(refreshIntent)
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("BG_ASSISTANT_CONFIG_SET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter.
    }
}
