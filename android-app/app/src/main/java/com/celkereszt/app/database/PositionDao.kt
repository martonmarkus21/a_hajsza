package com.celkereszt.app.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update

@Dao
interface PositionDao {
    @Insert
    fun insert(position: PositionEntity): Long

    @Query("SELECT * FROM positions WHERE synced = 0")
    fun getUnsynced(): List<PositionEntity>

    @Update
    fun markAsSynced(position: PositionEntity)

    @Query("UPDATE positions SET synced = 1 WHERE id = :id")
    fun markAsSynced(id: Long): Int
}