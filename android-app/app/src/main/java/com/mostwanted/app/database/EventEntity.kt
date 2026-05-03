package com.mostwanted.app.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val body: String,
    val type: String,
    val priority: String,
    val receivedAtMillis: Long = System.currentTimeMillis(),
    val isRead: Boolean = false,
)
