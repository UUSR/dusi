package com.dusi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ReactContext

object SystemEventManager {
  private var reactContext: ReactContext? = null
  private var listener: ((eventId: String) -> Unit)? = null

  fun setReactContext(context: ReactContext) {
    reactContext = context
  }

  fun setListener(listener: ((eventId: String) -> Unit)?) {
    this.listener = listener
  }

  fun emitEvent(eventId: String) {
    listener?.invoke(eventId)
    Log.d("SystemEventBroadcaster", "Emitted event: $eventId")
  }
}

class SystemEventBroadcastReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return

    val eventId = when (action) {
      Intent.ACTION_BATTERY_CHANGED -> {
        val status = intent.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, -1)
        val isCharging = status == android.os.BatteryManager.BATTERY_STATUS_CHARGING || 
                         status == android.os.BatteryManager.BATTERY_STATUS_FULL
        val plugged = intent.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, -1)
        
        if (plugged > 0 && isCharging) {
          "charging_started"
        } else if (plugged == 0 && !isCharging) {
          "charging_ended"
        } else {
          null
        }
      }
      Intent.ACTION_SCREEN_ON -> "screen_on"
      Intent.ACTION_SCREEN_OFF -> "screen_off"
      Intent.ACTION_BOOT_COMPLETED -> "boot_completed"
      "android.intent.action.BATTERY_LOW" -> "battery_low"
      Intent.ACTION_POWER_CONNECTED -> "charging_started"
      Intent.ACTION_POWER_DISCONNECTED -> "charging_ended"
      else -> null
    }

    if (eventId != null) {
      SystemEventManager.emitEvent(eventId)
      Log.d("SystemEventBroadcaster", "BroadcastReceiver: $action -> $eventId")
    }
  }
}
