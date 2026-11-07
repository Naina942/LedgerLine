package com.ledgerline.ledgerline.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ledgerline.ledgerline.entity.Transaction;

public interface TransactionRepository
        extends JpaRepository<Transaction, Long> {
}