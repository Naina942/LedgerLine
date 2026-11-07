package com.ledgerline.ledgerline.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ledgerline.ledgerline.entity.LedgerEntry;

public interface LedgerEntryRepository
        extends JpaRepository<LedgerEntry, Long> {

    List<LedgerEntry> findByAccountId(Long accountId);

    List<LedgerEntry> findByTransactionId(Long transactionId);
}