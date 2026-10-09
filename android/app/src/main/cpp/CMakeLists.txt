cmake_minimum_required(VERSION 3.22.1)
project(stronghold_mobile)

set(RUNTIME_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../.cache/android")
add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION
    "${RUNTIME_DIR}/jniLibs/${ANDROID_ABI}/libnode.so")

add_library(stronghold SHARED node_bridge.cpp)
target_include_directories(stronghold PRIVATE "${RUNTIME_DIR}/include")
find_library(log_lib log)
target_link_libraries(stronghold node ${log_lib})
