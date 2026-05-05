package com.celkereszt.app.repository

import android.content.Context
import com.celkereszt.app.database.AppDatabase
import com.celkereszt.app.database.EventEntity
import kotlinx.coroutines.flow.Flow

class EventRepository(context: Context) {
    private val eventDao = AppDatabase.getDatabase(context).eventDao()

    suspend fun addEvent(
        title: String,
        body: String,
        type: String,
        priority: String = "normal",
        isRead: Boolean = false,
    ) {
        eventDao.insert(
            EventEntity(
                title = title,
                body = body,
                type = type,
                priority = priority,
                isRead = isRead,
            ),
        )
    }

    fun observeLatestEvents(limit: Int = 40): Flow<List<EventEntity>> = eventDao.observeLatest(limit)

    suspend fun markRead(eventId: Long) {
        eventDao.markRead(eventId)
    }

    suspend fun markAllRead() {
        eventDao.markAllRead()
    }

    suspend fun clearAll() {
        eventDao.clearAll()
    }
}
