package com.bookmyturf;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BookMyTurfApp {

    public static void main(String[] args) {
        SpringApplication.run(BookMyTurfApp.class, args);
    }
}
