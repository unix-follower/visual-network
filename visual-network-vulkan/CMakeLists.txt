cmake_minimum_required(VERSION 4.3.3)

project(visual_network_vulkan VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(Vulkan REQUIRED)

add_executable(visual_network_vulkan src/visual_network_vulkan.cpp)
set_target_properties(visual_network_vulkan PROPERTIES OUTPUT_NAME visual_network_vulkan)

target_link_libraries(visual_network_vulkan PRIVATE Vulkan::Vulkan)

enable_testing()
find_package(GTest CONFIG REQUIRED)

add_executable(tests test/visual_network_vulkan_test.cpp)
target_link_libraries(
	tests
	PRIVATE visual_network_vulkan GTest::gtest GTest::gtest_main
)

include(GoogleTest)
gtest_discover_tests(tests DISCOVERY_TIMEOUT 30)
