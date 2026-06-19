import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box, Flex, SimpleGrid, Heading, Text, Stat, StatLabel, StatNumber, StatHelpText,
  Badge, Progress, Divider, Spinner, HStack, VStack,
} from "@chakra-ui/react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { api, type Stats, type Hotspot, type Breakdown } from "./api";
import HotspotMap from "./HotspotMap";

function heatColor(n: number) {
  if (n >= 50) return "#E53E3E";
  if (n >= 20) return "#DD6B20";
  return "#319795";
}
function severity(n: number): [string, string] {
  if (n >= 50) return ["Critical", "red"];
  if (n >= 20) return ["High", "orange"];
  return ["Moderate", "teal"];
}

const card = {
  bg: "gray.800", borderWidth: "1px", borderColor: "gray.700",
  rounded: "xl", p: 5,
};
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text color="teal.300" fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="widest" mb={1}>
      {children}
    </Text>
  );
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [top5, setTop5] = useState<Hotspot[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.hotspots(600).then(setHotspots).catch(() => {});
    api.hotspots(5).then(setTop5).catch(() => {});
    api.breakdown().then(setBreakdown).catch(() => {});
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(".snap"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.55) {
          items.forEach((s) => s.classList.toggle("active", s === e.target));
          setActive(Number((e.target as HTMLElement).dataset.i));
        }
      }),
      { root: panel, threshold: [0.55] }
    );
    items.forEach((s) => io.observe(s));
    items[0]?.classList.add("active");
    return () => io.disconnect();
  }, [stats, breakdown]);

  const nav = ["Overview", "Hotspot Map", "Patrol Optimizer", "Analytics"];
  const violData = breakdown?.violation_types.slice(0, 5).map((v) => ({
    name: v.name.replace("PARKING", "").replace(/_/g, " ").trim().slice(0, 14) || v.name,
    count: v.count,
  })) ?? [];

  return (
    <Flex h="100vh" bg="gray.900" color="gray.100">
      {/* SIDEBAR */}
      <Box w="240px" flexShrink={0} bg="gray.900" borderRightWidth="1px" borderColor="gray.700" p={4}>
        <HStack mb={8} px={2}>
          <Box w={7} h={7} rounded="md" bg="teal.400" display="grid" placeItems="center">
            <Box w={2.5} h={2.5} rounded="full" bg="gray.900" />
          </Box>
          <Text fontWeight="700">ParkSight</Text>
        </HStack>
        <VStack align="stretch" gap={1}>
          {nav.map((label, i) => (
            <Box key={label} px={3} py={2} rounded="md" fontSize="sm" cursor="pointer"
              bg={i === 0 ? "teal.900" : "transparent"} color={i === 0 ? "teal.200" : "gray.400"}
              fontWeight={i === 0 ? "600" : "400"} _hover={{ bg: "gray.800", color: "gray.100" }}>
              {label}
            </Box>
          ))}
        </VStack>
      </Box>

      {/* MAP */}
      <Box w="38%" minW="360px" position="relative" borderRightWidth="1px" borderColor="gray.700">
        <Flex position="absolute" zIndex={500} top={4} left={4} right={4} justify="space-between">
          <Box {...card} p={2} bg="rgba(26,32,44,.92)">
            <Text fontSize="2xs" color="gray.400" textTransform="uppercase">Region</Text>
            <HStack gap={2}><Box w={2} h={2} rounded="full" bg="teal.400" /><Text fontSize="sm">Bengaluru · Urban Core</Text></HStack>
          </Box>
          <Box {...card} p={2} bg="rgba(26,32,44,.92)"><Text fontSize="xs" color="gray.400">Nov 2023 – Apr 2024</Text></Box>
        </Flex>
        {hotspots.length ? <HotspotMap hotspots={hotspots} /> : <Flex h="100%" align="center" justify="center"><Spinner color="teal.400" /></Flex>}
      </Box>

      {/* RIGHT PANEL */}
      <Box flex={1} position="relative">
        <VStack position="absolute" zIndex={20} right={4} top="50%" transform="translateY(-50%)" gap={2}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={`dot ${active === i ? "on" : ""}`} />)}
        </VStack>

        <div className="panel" ref={panelRef}>
          {/* 1. KPIs */}
          <section className="snap" data-i={0}>
            <Eyebrow>City Overview</Eyebrow>
            <Heading size="lg" mb={6}>Parking Congestion at a Glance</Heading>
            <SimpleGrid columns={2} gap={4} maxW="620px">
              <Box {...card}><Stat><StatLabel color="gray.400">Hotspots</StatLabel><StatNumber fontSize="4xl">{stats ? stats.total_hotspots.toLocaleString("en-IN") : "—"}</StatNumber><StatHelpText>DBSCAN clusters</StatHelpText></Stat></Box>
              <Box {...card}><Stat><StatLabel color="gray.400">Violations analyzed</StatLabel><StatNumber fontSize="4xl">{stats ? stats.total_violations.toLocaleString("en-IN") : "—"}</StatNumber><StatHelpText>approved records</StatHelpText></Stat></Box>
              <Box {...card}><Stat><StatLabel color="gray.400">Recommended fleet</StatLabel><StatNumber fontSize="4xl" color="teal.300">{stats ? stats.recommended_fleet : "—"}</StatNumber><StatHelpText>optimal patrol units</StatHelpText></Stat></Box>
              <Box {...card}><Stat><StatLabel color="gray.400">Achievable coverage</StatLabel><StatNumber fontSize="4xl" color="teal.300">{stats ? `${stats.coverage_at_recommended_pct}%` : "—"}</StatNumber></Stat><Progress mt={2} value={stats?.coverage_at_recommended_pct ?? 0} colorScheme="teal" size="sm" rounded="full" /></Box>
            </SimpleGrid>
          </section>

          {/* 2. Top hotspots */}
          <section className="snap" data-i={1}>
            <Eyebrow>Where it concentrates</Eyebrow>
            <Heading size="lg" mb={6}>Top Enforcement Hotspots</Heading>
            <Box {...card} p={0} maxW="620px" overflow="hidden">
              {top5.map((h, idx) => {
                const [sevLabel, sevColor] = severity(h.cii_normalized);
                return (
                  <Box key={h.id}>
                    {idx > 0 && <Divider borderColor="gray.700" />}
                    <Flex px={5} py={4} justify="space-between" align="center">
                      <HStack gap={3}>
                        <Box w={2} h={2} rounded="full" bg={heatColor(h.cii_normalized)} />
                        <Text fontWeight="500">{h.station}</Text>
                        <Text fontSize="xs" color="gray.500">{h.violations.toLocaleString("en-IN")} violations</Text>
                      </HStack>
                      <Badge colorScheme={sevColor} variant="subtle">{sevLabel}</Badge>
                    </Flex>
                  </Box>
                );
              })}
            </Box>
          </section>

          {/* 3. Optimization insight */}
          <section className="snap" data-i={2}>
            <Eyebrow>Why targeting works</Eyebrow>
            <Heading size="lg" mb={6}>Optimization Insight</Heading>
            <VStack align="stretch" gap={4} maxW="620px">
              <Box {...card} borderLeftWidth="3px" borderLeftColor="teal.400" p={6}>
                <Text fontSize="xl" fontWeight="600" lineHeight={1.5}>
                  <Text as="span" color="teal.300">5</Text> optimally-placed patrols cover{" "}
                  <Text as="span" color="teal.300">~48%</Text> of the city's parking-congestion impact —
                  vs <Text as="span" color="gray.500">8%</Text> spread evenly.
                </Text>
              </Box>
              <SimpleGrid columns={3} gap={4}>
                <Box {...card}><Stat><StatLabel color="gray.400" fontSize="xs">Concentration</StatLabel><StatNumber>64%</StatNumber><StatHelpText>top 5% of cells</StatHelpText></Stat></Box>
                <Box {...card}><Stat><StatLabel color="gray.400" fontSize="xs">Rec. fleet</StatLabel><StatNumber color="teal.300">{stats?.recommended_fleet ?? "—"}</StatNumber><StatHelpText>covers {stats?.coverage_at_recommended_pct ?? "—"}%</StatHelpText></Stat></Box>
                <Box {...card}><Stat><StatLabel color="gray.400" fontSize="xs">Peak window</StatLabel><StatNumber>8–11</StatNumber><StatHelpText>AM · deploy early</StatHelpText></Stat></Box>
              </SimpleGrid>
            </VStack>
          </section>

          {/* 4. Metrics breakdown */}
          <section className="snap" data-i={3}>
            <Eyebrow>Under the hood</Eyebrow>
            <Heading size="lg" mb={6}>Metrics Breakdown</Heading>
            <SimpleGrid columns={2} gap={4} maxW="620px">
              <Box {...card}>
                <VStack align="stretch" gap={3}>
                  <Flex justify="space-between"><Text color="gray.400" fontSize="sm">Clustered</Text><Text fontWeight="600" fontSize="sm">{stats?.clustered_pct ?? "—"}%</Text></Flex>
                  <Flex justify="space-between"><Text color="gray.400" fontSize="sm">Noise (outliers)</Text><Text fontWeight="600" fontSize="sm">{stats?.noise_pct ?? "—"}%</Text></Flex>
                  <Flex justify="space-between"><Text color="gray.400" fontSize="sm">Peak window</Text><Text fontWeight="600" fontSize="sm" color="teal.300">8–11 AM</Text></Flex>
                  <Flex justify="space-between"><Text color="gray.400" fontSize="sm">Evening share</Text><Text fontWeight="600" fontSize="sm" color="orange.300">{stats?.evening_share_pct ?? "—"}%</Text></Flex>
                  <Divider borderColor="gray.700" />
                  <Text fontSize="xs" color="gray.500">Evenings (5–9 PM) are an enforcement gap.</Text>
                </VStack>
              </Box>
              <Box {...card}>
                <Text color="gray.400" fontSize="xs" textTransform="uppercase" letterSpacing="wide" mb={3}>Top violation types</Text>
                {violData.length ? (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart layout="vertical" data={violData} margin={{ left: 8, right: 8 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fill: "#A0AEC0", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="count" fill="#319795" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Flex h="170px" align="center" justify="center"><Spinner size="sm" color="teal.400" /></Flex>}
              </Box>
            </SimpleGrid>
          </section>
        </div>
      </Box>
    </Flex>
  );
}
