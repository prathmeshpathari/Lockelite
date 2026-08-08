package com.lockelite.repository;

import com.lockelite.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmailOrUsername(String email, String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    List<User> findByRole(User.Role role);
    List<User> findByRoleAndBranchId(User.Role role, Long branchId);

    @Query("SELECT u FROM User u WHERE u.role = 'EMPLOYEE' AND u.branchId = :branchId AND u.isActive = true")
    List<User> findActiveEmployeesByBranch(Long branchId);
}
