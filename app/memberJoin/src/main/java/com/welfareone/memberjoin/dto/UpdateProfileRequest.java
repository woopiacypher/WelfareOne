package com.welfareone.memberjoin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @JsonProperty("default_region_level1")
    private String defaultRegionLevel1;

    @JsonProperty("default_region_level2")
    private String defaultRegionLevel2;

    @JsonProperty("default_age")
    private Integer defaultAge;
}

