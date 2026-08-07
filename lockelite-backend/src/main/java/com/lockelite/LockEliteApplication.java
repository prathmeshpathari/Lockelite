package com.lockelite;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class LockEliteApplication {
    public static void main(String[] args) {
        SpringApplication.run(LockEliteApplication.class, args);
    }
}
