import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Flex, HStack, VStack, Text, Heading, Tabs, TabList, Tab, TabPanels,
  TabPanel, SimpleGrid, Stat, StatLabel, StatNumber, Badge, Skeleton,
  Progress, Tooltip as ChakraTooltip, Spinner
} from '@chakra-ui/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { api, formatIN, heatColor, severityLabel } from '../api';
import type { Temporal, Breakdown, BlindSpotsResponse } from '../api';

function tempColor(val: number, maxVal: number): string {
  if (val === 0) return 'rgba(255,255,255,0.03)';
  const t = Math.min(1, val / maxVal);
  if (t < 0.33) return `rgba(56, 178, 172, ${0.2 + t * 1.5})`;
  if (t < 0.66) return `rgba(245, 166, 35, ${0.3 + (t - 0.33) * 1.5})`;
  return `rgba(239, 68, 68, ${0.4 + (t - 0.66) * 1.5})`;
}

export default function Analytics() {
  const [temporal, setTemporal] = useState<Temporal | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [blindSpots, setBlindSpots] = useState<BlindSpotsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.temporal().then(setTemporal),
      api.breakdown().then(setBreakdown),
      api.blindspots(30).then(setBlindSpots),
    ]).finally(() => setLoading(false));
  }, []);

  const cardStyle = {
    bg: "gray.800", borderWidth: "1px", borderColor: "gray.700", rounded: "xl", p: 5
  };

  const maxTemp = temporal ? Math.max(...temporal.matrix.flat()) : 1;

  if (loading) {
    return (
      <Flex h="100%" align="center" justify="center">
        <Spinner size="xl" color="teal.400" />
      </Flex>
    );
  }

  return (
    <Flex h="100%" direction="column" overflow="hidden">
      {/* Header */}
      <Box px={8} py={6} borderBottomWidth="1px" borderColor="gray.700" bg="gray.800">
        <Heading size="lg">Analytics</Heading>
      </Box>

      <Box flex={1} overflowY="auto" px={8} py={6}>
        <Tabs variant="soft-rounded" colorScheme="teal" isLazy>
          <TabList mb={6}>
            <Tab>Temporal Heatmap</Tab>
            <Tab>Violations</Tab>
            <Tab>Vehicles</Tab>
            <Tab>Blind Spots</Tab>
          </TabList>

          <TabPanels>
            {/* Temporal Heatmap */}
            <TabPanel p={0}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Box {...cardStyle} maxW="900px">
                  <Heading size="md" mb={6}>Day × Hour Violation Concentration</Heading>
                  {temporal && (
                    <Box>
                      <Flex mb={2}>
                        <Box w="60px" />
                        <Flex flex={1} justify="space-between">
                          {temporal.hours.map(h => (
                            <Text key={h} fontSize="2xs" color="gray.500" w="28px" textAlign="center">
                              {h.toString().padStart(2, '0')}
                            </Text>
                          ))}
                        </Flex>
                      </Flex>
                      {temporal.days.map((day, dIdx) => (
                        <Flex key={day} mb={1} align="center">
                          <Text w="60px" fontSize="sm" fontWeight="500" color="gray.400">{day}</Text>
                          <Flex flex={1} justify="space-between" gap="2px">
                            {temporal.matrix[dIdx].map((val, hIdx) => (
                              <ChakraTooltip key={hIdx} label={`${day} ${hIdx}:00 — ${formatIN(val)} violations`} placement="top" hasArrow>
                                <Box 
                                  className="heatmap-cell" 
                                  w="28px" 
                                  h="28px" 
                                  bg={tempColor(val, maxTemp)}
                                />
                              </ChakraTooltip>
                            ))}
                          </Flex>
                        </Flex>
                      ))}
                      <HStack mt={8} gap={4}>
                        <Text fontSize="sm" color="gray.400">Peak hours:</Text>
                        {temporal.peak_hours.map(h => (
                          <Badge key={h} colorScheme="red" variant="subtle">{h}:00</Badge>
                        ))}
                      </HStack>
                    </Box>
                  )}
                </Box>
              </motion.div>
            </TabPanel>

            {/* Violations */}
            <TabPanel p={0}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Box {...cardStyle} maxW="900px" h="500px">
                  <Heading size="md" mb={6}>Top Violation Types</Heading>
                  {breakdown && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={breakdown.violation_types.slice(0, 10)} margin={{ left: 100, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={150} tick={{ fill: "#A0AEC0", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1a202c', borderColor: '#2d3748', borderRadius: '8px' }} />
                        <Bar dataKey="count" fill="#319795" radius={[0, 4, 4, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </motion.div>
            </TabPanel>

            {/* Vehicles */}
            <TabPanel p={0}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Box {...cardStyle} maxW="900px" h="500px">
                  <Heading size="md" mb={6}>Top Vehicle Types</Heading>
                  {breakdown && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={breakdown.vehicle_types.slice(0, 10)} margin={{ left: 100, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#A0AEC0", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1a202c', borderColor: '#2d3748', borderRadius: '8px' }} />
                        <Bar dataKey="count" fill="#3182ce" radius={[0, 4, 4, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </motion.div>
            </TabPanel>

            {/* Blind Spots */}
            <TabPanel p={0}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <VStack align="stretch" gap={6} maxW="900px">
                  {blindSpots && (
                    <>
                      <SimpleGrid columns={3} gap={4}>
                        <Box {...cardStyle} bg="red.900" borderColor="red.700">
                          <Stat>
                            <StatLabel color="red.200">Critical Blind Spots</StatLabel>
                            <StatNumber color="white">{blindSpots.critical_count}</StatNumber>
                          </Stat>
                        </Box>
                        <Box {...cardStyle} bg="orange.900" borderColor="orange.700">
                          <Stat>
                            <StatLabel color="orange.200">High Blind Spots</StatLabel>
                            <StatNumber color="white">{blindSpots.high_count}</StatNumber>
                          </Stat>
                        </Box>
                        <Box {...cardStyle} bg="teal.900" borderColor="teal.700">
                          <Stat>
                            <StatLabel color="teal.200">Moderate Blind Spots</StatLabel>
                            <StatNumber color="white">{blindSpots.moderate_count}</StatNumber>
                          </Stat>
                        </Box>
                      </SimpleGrid>

                      <Box {...cardStyle}>
                        <Heading size="md" mb={6}>Under-Enforced High-Impact Zones</Heading>
                        <VStack align="stretch" gap={4}>
                          {blindSpots.zones.map((zone) => {
                            const [sLabel, sColor] = severityLabel(zone.cii_normalized);
                            return (
                              <Box key={zone.id} p={4} bg="gray.900" rounded="lg" borderWidth="1px" borderColor="gray.700">
                                <Flex justify="space-between" align="start" mb={3}>
                                  <HStack align="start" gap={3}>
                                    <Badge colorScheme="gray" variant="solid" fontSize="md" px={2} py={1}>#{zone.rank}</Badge>
                                    <Box>
                                      <Text fontWeight="600" fontSize="lg">{zone.station}</Text>
                                      <Text fontSize="sm" color="gray.400">{zone.dominant_violation}</Text>
                                    </Box>
                                  </HStack>
                                  <Badge colorScheme={sColor} variant="subtle" size="lg">{sLabel}</Badge>
                                </Flex>
                                
                                <Box mb={3}>
                                  <Flex justify="space-between" mb={1}>
                                    <Text fontSize="xs" color="gray.500">Blind Spot Score</Text>
                                    <Text fontSize="xs" fontWeight="600">{zone.blind_spot_score.toFixed(3)}</Text>
                                  </Flex>
                                  <Progress value={Math.max(0, Math.min(100, zone.blind_spot_score * 100))} colorScheme={sColor} size="sm" rounded="full" />
                                </Box>
                                
                                <HStack gap={6}>
                                  <Text fontSize="sm"><Text as="span" color="gray.500">Violations: </Text><b>{formatIN(zone.violations)}</b></Text>
                                  <Text fontSize="sm"><Text as="span" color="gray.500">Peak Shift: </Text><b>{zone.shift}</b></Text>
                                </HStack>
                              </Box>
                            );
                          })}
                        </VStack>
                      </Box>
                    </>
                  )}
                </VStack>
              </motion.div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Flex>
  );
}
