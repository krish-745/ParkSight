import { NavLink, Outlet, Navigate, Routes, Route } from "react-router-dom";
import { Box, Flex, HStack, Text, VStack, Icon } from "@chakra-ui/react";
import {
  IconLayoutDashboard,
  IconChartBar,
  IconRoute,
} from "@tabler/icons-react";
import { lazy, Suspense } from "react";
import { Spinner } from "@chakra-ui/react";

const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const Analytics = lazy(() => import("./pages/Analytics"));
const RoutePlanner = lazy(() => import("./pages/RoutePlanner"));

const NAV = [
  { to: "/command", label: "Command Center", icon: IconLayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: IconChartBar },
  { to: "/routes", label: "Route Planner", icon: IconRoute },
] as const;

function PageLoader() {
  return (
    <Flex h="100%" align="center" justify="center" bg="gray.900">
      <VStack gap={4}>
        <Spinner size="xl" color="teal.400" thickness="3px" />
        <Text color="gray.500" fontSize="sm">Loading…</Text>
      </VStack>
    </Flex>
  );
}

function Layout() {
  return (
    <Flex h="100vh" bg="gray.900" color="gray.100">
      {/* ── SIDEBAR ── */}
      <Box
        as="nav"
        w="280px"
        minW="280px"
        bg="gray.900"
        borderRightWidth="1px"
        borderColor="gray.700"
        display="flex"
        flexDirection="column"
      >
        {/* Logo */}
        <HStack px={6} pt={7} pb={6} gap={3}>
          <Box
            w={9}
            h={9}
            rounded="lg"
            bg="teal.400"
            display="grid"
            placeItems="center"
            flexShrink={0}
          >
            <Box w={3} h={3} rounded="full" bg="gray.900" />
          </Box>
          <Text fontSize="lg" fontWeight="800" letterSpacing="-0.02em">
            ParkSight
          </Text>
        </HStack>

        {/* Section label */}
        <Text
          px={6}
          pb={2}
          fontSize="2xs"
          fontWeight="700"
          textTransform="uppercase"
          letterSpacing="widest"
          color="gray.500"
        >
          Operations
        </Text>

        {/* Nav items */}
        <VStack align="stretch" gap={1} px={4}>
          {NAV.map(({ to, label, icon: TablerIcon }) => (
            <NavLink key={to} to={to} style={{ textDecoration: "none" }}>
              {({ isActive }) => (
                <HStack
                  px={4}
                  py={3}
                  rounded="lg"
                  gap={3}
                  cursor="pointer"
                  bg={isActive ? "teal.900" : "transparent"}
                  color={isActive ? "teal.200" : "gray.400"}
                  fontWeight={isActive ? "600" : "400"}
                  fontSize="sm"
                  transition="all 0.2s"
                  _hover={{ bg: isActive ? "teal.900" : "gray.800", color: "gray.100" }}
                >
                  <Icon as={TablerIcon} boxSize={5} />
                  <Text>{label}</Text>
                </HStack>
              )}
            </NavLink>
          ))}
        </VStack>

        {/* Spacer + footer */}
        <Box flex={1} />
        <VStack px={6} pb={6} gap={1} align="start">
          <Text fontSize="xs" fontWeight="600" color="gray.400">
            Bengaluru Traffic Police
          </Text>
          <Text fontSize="2xs" color="gray.600">
            Parking Enforcement Cell
          </Text>
        </VStack>
      </Box>

      {/* ── MAIN CONTENT ── */}
      <Box flex={1} overflow="hidden">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </Box>
    </Flex>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/command" replace />} />
        <Route path="command" element={<CommandCenter />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="routes" element={<RoutePlanner />} />
        <Route path="*" element={<Navigate to="/command" replace />} />
      </Route>
    </Routes>
  );
}
