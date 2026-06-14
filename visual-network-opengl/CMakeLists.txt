cmake_minimum_required(VERSION 4.3.3)

project(visual_network_opengl VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(OpenGL REQUIRED)
find_package(glfw3 REQUIRED CONFIG)

add_executable(visual_network_opengl src/visual_network_opengl.cpp)
set_target_properties(visual_network_opengl PROPERTIES OUTPUT_NAME visual_network_opengl)
target_link_libraries(visual_network_opengl PRIVATE OpenGL::GL glfw)

enable_testing()
find_package(GTest CONFIG REQUIRED)

add_executable(tests test/visual_network_opengl_test.cpp)
target_link_libraries(
	tests
	PRIVATE visual_network_opengl GTest::gtest GTest::gtest_main
)

include(GoogleTest)
gtest_discover_tests(tests DISCOVERY_TIMEOUT 30)
