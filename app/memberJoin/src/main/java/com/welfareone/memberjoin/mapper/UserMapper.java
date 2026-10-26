package com.welfareone.memberjoin.mapper;

import com.welfareone.memberjoin.domain.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {
    int insertUser(User user);
    User findByEmail(@Param("email") String email);
    User findById(@Param("userId") Long userId);
    int countByEmail(@Param("email") String email);
    int updateProfile(@Param("userId") Long userId,
                      @Param("defaultRegionLevel1") String defaultRegionLevel1,
                      @Param("defaultRegionLevel2") String defaultRegionLevel2,
                      @Param("defaultAge") Integer defaultAge);
}

