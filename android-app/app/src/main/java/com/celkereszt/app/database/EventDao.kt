package com.celkereszt.app.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface EventDao {
    @Insert
    suspend fun insert(event: EventEntity): Long

    @Query("SELECT * FROM events ORDER BY receivedAtMillis DESC LIMIT :limit")
    fun observeLatest(limit: Int): Flow<List<EventEntity>>

    @Query("UPDATE events SET isRead = 1 WHERE id = :eventId")
    suspend fun markRead(eventId: Long)

    @Query("UPDATE events SET isRead = 1")
    suspend fun markAllRead()

    @Query("DELETE FROM events")
    suspend fun clearAll()
}
