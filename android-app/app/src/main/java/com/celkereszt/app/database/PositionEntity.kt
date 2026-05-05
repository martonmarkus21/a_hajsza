package com.celkereszt.app.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "positions")
data class PositionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val deviceId: String,
    val pairId: Int,
    val lat: Double,
    val lon: Double,
    val accuracy: Double?,
    val speed: Double?,
    val timestamp: String,
    val vehicleMode: Boolean = false,
    val vehicleSessionRemaining: Int? = null,
    val synced: Boolean = false
)






