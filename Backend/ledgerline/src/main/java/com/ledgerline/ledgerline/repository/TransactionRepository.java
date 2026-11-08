
package com.ledgerline.ledgerline.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ledgerline.ledgerline.entity.Transaction;

public interface TransactionRepository
        extends JpaRepository<Transaction, Long> {

    @Query("""
            SELECT DISTINCT t
            FROM Transaction t
            LEFT JOIN t.sourceAccount source
            LEFT JOIN source.owner sourceOwner
            LEFT JOIN t.destinationAccount destination
            LEFT JOIN destination.owner destinationOwner
            WHERE sourceOwner.username = :username
               OR destinationOwner.username = :username
            ORDER BY t.createdAt DESC
            """)
    List<Transaction> findMyTransactions(
            @Param("username") String username
    );
}
