package com.ledgerline.ledgerline.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ledgerline.ledgerline.entity.IdempotencyRecord;

public interface IdempotencyRecordRepository
        extends JpaRepository<IdempotencyRecord, Long> {

    Optional<IdempotencyRecord> findByIdempotencyKey(String idempotencyKey);

    boolean existsByIdempotencyKey(String idempotencyKey);
}