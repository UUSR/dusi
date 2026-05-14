package com.dusi

import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class SystemEventModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val receiver = SystemEventBroadcastReceiver()
  private val intentFilter = IntentFilter().apply {
    addAction(android.content.Intent.ACTION_BATTERY_CHANGED)
    addAction(android.content.Intent.ACTION_POWER_CONNECTED)
    addAction(android.content.Intent.ACTION_POWER_DISCONNECTED)
    addAction(android.content.Intent.ACTION_SCREEN_ON)
    addAction(android.content.Intent.ACTION_SCREEN_OFF)
    addAction(android.content.Intent.ACTION_BOOT_COMPLETED)
    addAction("android.intent.action.BATTERY_LOW")
  }

  override fun getName() = "SystemEvent"

  init {
    SystemEventManager.setReactContext(reactContext)
    SystemEventManager.setListener { eventId ->
      sendEvent(eventId)
    }
  }

  @ReactMethod
  fun startListening(promise: Promise) {
    try {
      reactApplicationContext.registerReceiver(receiver, intentFilter, android.Manifest.permission.BATTERY_STATS, null)
      promise.resolve("Listening for system events")
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    try {
      reactApplicationContext.unregisterReceiver(receiver)
      promise.resolve("Stopped listening for system events")
    } catch (e: Exception) {
      promise.reject("ERROR", e.message)
    }
  }

  private fun sendEvent(eventId: String) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("SystemEvent", eventId)
  }
}
