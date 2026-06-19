import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Flex, HStack, VStack, Text, Heading, Stat, StatLabel, StatNumber,
  StatHelpText, SimpleGrid, Skeleton, Badge, Progress, Spinner
} from '@chakra-ui/react';
import HotspotMap from '../HotspotMap';
import { api, formatIN, STATIONS, VIOLATIONS } from '../api';
import type { Stats, Hotspot, OptimizeResult } from '../api';

export default function CommandCenter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [optimizeData, setOptimizeData] = useState<OptimizeResult | null>(null);
  
  // Controls
  const [patrols, setPatrols] = useState(15);
  const [radius, setRadius] = useState(1000);
  const [violation, setViolation] = useState('all');
  const [station, setStation] = useState('all');
  const [showHexbin, setShowHexbin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      api.stats().then(setStats),
      api.hotspots(600, violation, station).then(setHotspots),
    ]).finally(() => setLoading(false));
  }, [violation, station]);

  // Debounced optimizer
  useEffect(() => {
    setOptimizing(true);
    const timer = setTimeout(() => {
      api.optimize(patrols, radius)
        .then(setOptimizeData)
        .finally(() => setOptimizing(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [patrols, radius]);

  const cardStyle = {
    bg: "gray.800", borderWidth: "1px", borderColor: "gray.700", rounded: "xl", p: 5
  };

  return (
    <Flex h="100%" direction="column" overflow="hidden">
      {/* Header */}
      <Box px={8} py={4} borderBottomWidth="1px" borderColor="gray.700" bg="gray.800" flexShrink={0}>
        <Flex justify="space-between" align="center">
          <Heading size="lg">Command Center</Heading>
          <HStack gap={4}>
            <HStack gap={2}>
              <Box w={2} h={2} rounded="full" bg="teal.400" />
              <Text fontSize="sm" color="gray.300">Bengaluru · Urban Core</Text>
            </HStack>
            <Badge colorScheme="gray">{stats?.date_range ?? "Loading..."}</Badge>
          </HStack>
        </Flex>
      </Box>

      {/* KPI Cards */}
      <Box px={8} py={4} flexShrink={0}>
        <SimpleGrid columns={4} gap={4}>
          <Skeleton isLoaded={!!stats} rounded="xl">
            <Box {...cardStyle}>
              <Stat>
                <StatLabel color="gray.400">Total Hotspots</StatLabel>
                <StatNumber fontSize="3xl">{stats ? formatIN(stats.total_hotspots) : "-"}</StatNumber>
                <StatHelpText>{stats?.clustered_pct}% clustered</StatHelpText>
              </Stat>
            </Box>
          </Skeleton>
          <Skeleton isLoaded={!!stats} rounded="xl">
            <Box {...cardStyle}>
              <Stat>
                <StatLabel color="gray.400">Total Violations</StatLabel>
                <StatNumber fontSize="3xl">{stats ? formatIN(stats.total_violations) : "-"}</StatNumber>
                <StatHelpText>analyzed records</StatHelpText>
              </Stat>
            </Box>
          </Skeleton>
          <Skeleton isLoaded={!!stats} rounded="xl">
            <Box {...cardStyle}>
              <Stat>
                <StatLabel color="gray.400">Recommended Fleet</StatLabel>
                <StatNumber fontSize="3xl" color="teal.300">{stats?.recommended_fleet ?? "-"}</StatNumber>
                <StatHelpText>optimal patrol units</StatHelpText>
              </Stat>
            </Box>
          </Skeleton>
          <Skeleton isLoaded={!!stats} rounded="xl">
            <Box {...cardStyle}>
              <Stat>
                <StatLabel color="gray.400">Achievable Coverage</StatLabel>
                <StatNumber fontSize="3xl" color="teal.300">{stats?.coverage_at_recommended_pct ?? "-"}%</StatNumber>
                <Progress mt={2} value={stats?.coverage_at_recommended_pct ?? 0} colorScheme="teal" size="xs" rounded="full" />
              </Stat>
            </Box>
          </Skeleton>
        </SimpleGrid>
      </Box>

      {/* Main Area */}
      <Flex flex={1} overflow="hidden" px={8} pb={8} gap={6}>
        {/* Map */}
        <Box flex={1} position="relative" rounded="xl" overflow="hidden" borderWidth="1px" borderColor="gray.700">
          <div className="map-controls">
            <button 
              className={`map-control-btn ${showHexbin ? 'active' : ''}`}
              onClick={() => setShowHexbin(!showHexbin)}
              title="Toggle Hexbin View"
            >
              ⬡
            </button>
          </div>
          {loading ? (
            <Flex h="100%" align="center" justify="center" bg="gray.800"><Spinner color="teal.400" size="xl" /></Flex>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} style={{ height: '100%' }}>
              <HotspotMap hotspots={hotspots} optimize={optimizeData} showHexbin={showHexbin} />
            </motion.div>
          )}
        </Box>

        {/* Optimizer Panel */}
        <Box w="350px" flexShrink={0} overflowY="auto">
          <Box {...cardStyle}>
            <Heading size="md" mb={1}>Patrol Optimizer</Heading>
            <Text fontSize="xs" color="gray.400" mb={6}>Maximum-coverage deployment</Text>

            <Skeleton isLoaded={!!optimizeData} rounded="md" mb={6}>
              <Box bg="gray.900" p={4} rounded="md" borderWidth="1px" borderColor="gray.700">
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" mb={1}>Impact Coverage</Text>
                <HStack align="baseline">
                  <Text fontSize="4xl" fontWeight="700" color="teal.300">{optimizeData?.total_coverage_pct ?? "0"}%</Text>
                  {optimizing && <Spinner size="xs" color="teal.400" />}
                </HStack>
                <HStack mt={3} gap={3}>
                  <Badge colorScheme="gray" variant="subtle">Even: {optimizeData?.baseline_even_pct}%</Badge>
                  <Badge colorScheme="gray" variant="subtle">Volume: {optimizeData?.baseline_volume_pct}%</Badge>
                </HStack>
              </Box>
            </Skeleton>

            <VStack gap={5} align="stretch" mb={6}>
              <Box>
                <Flex justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.400">Patrol units</Text>
                  <Text fontSize="sm" fontWeight="600">{patrols}</Text>
                </Flex>
                <input type="range" min={1} max={40} value={patrols} onChange={(e) => setPatrols(parseInt(e.target.value))} style={{ width: '100%' }} />
              </Box>
              <Box>
                <Flex justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.400">Coverage radius</Text>
                  <Text fontSize="sm" fontWeight="600">{radius} m</Text>
                </Flex>
                <input type="range" min={200} max={3000} step={100} value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} style={{ width: '100%' }} />
              </Box>
            </VStack>

            <Box borderTopWidth="1px" borderColor="gray.700" pt={5}>
              <Text fontSize="sm" fontWeight="600" mb={4}>Filters</Text>
              <VStack gap={3}>
                <Box w="100%">
                  <Text fontSize="xs" color="gray.500" mb={1}>Violation Type</Text>
                  <select 
                    value={violation} 
                    onChange={(e) => setViolation(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1a202c', color: '#fff', border: '1px solid #2d3748', borderRadius: '6px' }}
                  >
                    <option value="all">All violations</option>
                    {VIOLATIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Box>
                <Box w="100%">
                  <Text fontSize="xs" color="gray.500" mb={1}>Police Station</Text>
                  <select 
                    value={station} 
                    onChange={(e) => setStation(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#1a202c', color: '#fff', border: '1px solid #2d3748', borderRadius: '6px' }}
                  >
                    <option value="all">All stations</option>
                    {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Box>
              </VStack>
            </Box>
          </Box>
        </Box>
      </Flex>
    </Flex>
  );
}
