package com.lockelite.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lockelite.dto.BranchDistanceDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/branches")
@Tag(name = "Branches", description = "Real bank branch search using Google Places API")
public class BranchController {

    private static final Logger log = LoggerFactory.getLogger(BranchController.class);

    private static final String GOOGLE_API_KEY   = "AIzaSyD8eCI-9GrxossEoxp9E_-vOuR6dkOWmy4";
    private static final String PLACES_OLD_URL   = "https://maps.googleapis.com/maps/api/place/textsearch/json";
    private static final String PLACES_NEW_URL   = "https://places.googleapis.com/v1/places:searchText";

    private final HttpClient   httpClient   = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Map<String, String> BANK_KEYWORDS = new LinkedHashMap<>();
    static {
        BANK_KEYWORDS.put("SBI",       "State Bank of India");
        BANK_KEYWORDS.put("HDFC",      "HDFC Bank");
        BANK_KEYWORDS.put("ICICI",     "ICICI Bank");
        BANK_KEYWORDS.put("AXIS",      "Axis Bank");
        BANK_KEYWORDS.put("KOTAK",     "Kotak Mahindra Bank");
        BANK_KEYWORDS.put("LOCKELITE", "LockElite");
    }

    @GetMapping("/public")
    @Operation(summary = "Find real bank branches near user location")
    public ResponseEntity<List<BranchDistanceDto>> getPublicBranches(
            @RequestParam String  bankName,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false, defaultValue = "25000") int radiusMeters) {

        double userLat = latitude  != null ? latitude  : 20.5937;
        double userLng = longitude != null ? longitude : 78.9629;
        int    radius  = Math.min(radiusMeters, 50000);

        String bankCode = bankName.toUpperCase().trim();

        if ("LOCKELITE".equals(bankCode)) {
            return ResponseEntity.ok(lockEliteSeededBranches(userLat, userLng));
        }

        String keyword = BANK_KEYWORDS.getOrDefault(bankCode, bankName);

        // Try Places API (New) Text Search first
        List<BranchDistanceDto> results = queryPlacesNewTextSearch(userLat, userLng, radius, keyword);

        // If empty, try Old Places API Text Search
        if (results.isEmpty()) {
            log.warn("[Places] New API returned 0 — trying Old Places API");
            results = queryPlacesOldTextSearch(userLat, userLng, radius, keyword);
        }

        results.sort(Comparator.comparingDouble(BranchDistanceDto::getDistanceKm));
        log.info("[Places] {} -> {} results within {}m of ({},{})",
                bankCode, results.size(), radius, userLat, userLng);

        return ResponseEntity.ok(results);
    }

    // ─────────────────────────────────────────────────────────────────────
    // PLACES API (NEW) — Text Search
    // ─────────────────────────────────────────────────────────────────────
    private List<BranchDistanceDto> queryPlacesNewTextSearch(double lat, double lng,
                                                              int radius, String keyword) {
        List<BranchDistanceDto> results = new ArrayList<>();
        try {
            String requestBody = String.format("""
                {
                  "textQuery": "%s bank branch",
                  "includedType": "bank",
                  "maxResultCount": 20,
                  "locationBias": {
                    "circle": {
                      "center": { "latitude": %s, "longitude": %s },
                      "radius": %d
                    }
                  }
                }
                """, keyword.replace("\"", "\\\""), lat, lng, radius);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(PLACES_NEW_URL))
                    .header("Content-Type", "application/json")
                    .header("X-Goog-Api-Key", GOOGLE_API_KEY)
                    .header("X-Goog-FieldMask",
                            "places.id,places.displayName,places.formattedAddress,places.location,places.shortFormattedAddress")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("[Places New] HTTP {} body: {}", resp.statusCode(),
                    resp.body().length() > 200 ? resp.body().substring(0, 200) : resp.body());

            if (resp.statusCode() != 200) return results;

            JsonNode root   = objectMapper.readTree(resp.body());
            JsonNode places = root.path("places");
            if (!places.isArray()) return results;

            for (JsonNode place : places) {
                String name    = place.path("displayName").path("text").asText();
                String placeId = place.path("id").asText();
                String address = place.path("shortFormattedAddress").asText();
                if (address.isEmpty()) address = place.path("formattedAddress").asText();

                JsonNode loc  = place.path("location");
                double   pLat = loc.path("latitude").asDouble();
                double   pLng = loc.path("longitude").asDouble();
                if (pLat == 0 && pLng == 0) continue;

                double dist  = Math.round(haversine(lat, lng, pLat, pLng) * 10.0) / 10.0;
                int    hash  = placeId.hashCode();
                long lockers = 8 + Math.abs(hash % 15);
                long avail   = 1 + Math.abs(hash % (lockers - 1));

                results.add(BranchDistanceDto.builder()
                        .id("gn_" + placeId).branchName(name).address(address)
                        .distanceKm(dist).distance(dist)
                        .latitude(BigDecimal.valueOf(pLat)).longitude(BigDecimal.valueOf(pLng))
                        .lockers(lockers).available(avail).build());
            }
        } catch (Exception e) {
            log.error("[Places New] Error: {}", e.getMessage());
        }
        return results;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PLACES API (OLD) — Text Search
    // ─────────────────────────────────────────────────────────────────────
    private List<BranchDistanceDto> queryPlacesOldTextSearch(double lat, double lng,
                                                              int radius, String keyword) {
        List<BranchDistanceDto> results = new ArrayList<>();
        try {
            String query = keyword + " bank branch";
            String url   = PLACES_OLD_URL
                    + "?query=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
                    + "&location=" + lat + "," + lng
                    + "&radius=" + radius
                    + "&type=bank"
                    + "&key=" + GOOGLE_API_KEY;

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("[Places Old] HTTP {} body: {}", resp.statusCode(),
                    resp.body().length() > 300 ? resp.body().substring(0, 300) : resp.body());

            if (resp.statusCode() != 200) return results;

            JsonNode root    = objectMapper.readTree(resp.body());
            String   status  = root.path("status").asText();
            log.info("[Places Old] Status: {}", status);

            if (!"OK".equals(status)) return results;

            for (JsonNode place : root.path("results")) {
                String name    = place.path("name").asText();
                String placeId = place.path("place_id").asText();
                String address = place.path("formatted_address").asText();

                JsonNode loc  = place.path("geometry").path("location");
                double   pLat = loc.path("lat").asDouble();
                double   pLng = loc.path("lng").asDouble();
                if (pLat == 0 && pLng == 0) continue;

                // Only include results that actually match our bank
                if (!name.toLowerCase().contains(keyword.split(" ")[0].toLowerCase())) continue;

                double dist  = Math.round(haversine(lat, lng, pLat, pLng) * 10.0) / 10.0;
                int    hash  = placeId.hashCode();
                long lockers = 8 + Math.abs(hash % 15);
                long avail   = 1 + Math.abs(hash % (lockers - 1));

                results.add(BranchDistanceDto.builder()
                        .id("go_" + placeId).branchName(name).address(address)
                        .distanceKm(dist).distance(dist)
                        .latitude(BigDecimal.valueOf(pLat)).longitude(BigDecimal.valueOf(pLng))
                        .lockers(lockers).available(avail).build());
            }
        } catch (Exception e) {
            log.error("[Places Old] Error: {}", e.getMessage());
        }
        return results;
    }

    // ─────────────────────────────────────────────────────────────────────
    // LOCKELITE SEEDED
    // ─────────────────────────────────────────────────────────────────────
    private List<BranchDistanceDto> lockEliteSeededBranches(double userLat, double userLng) {
        record LeBranch(String id, String name, String address, double lat, double lng) {}
        List<LeBranch> seeded = List.of(
            new LeBranch("le_vasind",     "LockElite Vasind Branch",
                    "Main Road, Vasind, Maharashtra 421604",        19.3248, 73.3042),
            new LeBranch("le_thane",      "LockElite Thane Branch",
                    "Station Road, Thane West, Maharashtra 400601", 19.2183, 72.9781),
            new LeBranch("le_navimumbai", "LockElite Navi Mumbai Branch",
                    "Sector 5, Vashi, Navi Mumbai 400703",          19.0748, 72.9987)
        );
        return seeded.stream().map(b -> {
            double dist = Math.round(haversine(userLat, userLng, b.lat(), b.lng()) * 10.0) / 10.0;
            return BranchDistanceDto.builder()
                    .id(b.id()).branchName(b.name()).address(b.address())
                    .distanceKm(dist).distance(dist)
                    .latitude(BigDecimal.valueOf(b.lat())).longitude(BigDecimal.valueOf(b.lng()))
                    .lockers(12L).available(8L).build();
        }).sorted(Comparator.comparingDouble(BranchDistanceDto::getDistanceKm))
          .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────
    // HAVERSINE
    // ─────────────────────────────────────────────────────────────────────
    private double haversine(double lat1, double lng1, double lat2, double lng2) {
        double R    = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a    = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.asin(Math.sqrt(a));
    }
}