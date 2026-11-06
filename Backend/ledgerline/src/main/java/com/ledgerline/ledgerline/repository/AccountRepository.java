package com.ledgerline.ledgerline.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ledgerline.ledgerline.entity.Account;

public interface AccountRepository extends JpaRepository<Account, Long> {

    Optional<Account> findByAccountNumber(String accountNumber);

    List<Account> findByOwnerId(Long ownerId);

    boolean existsByAccountNumber(String accountNumber);
}