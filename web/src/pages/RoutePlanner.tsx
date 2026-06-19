import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Flex, HStack, VStack, Text, Heading, Button, Badge, Spinner,
  Skeleton, Table, Thead, Tbody, Tr, Th, Td, TableContainer,
} from '@chakra-ui/react';

import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api, formatIN } from '../api';
import type { RouteResponse, Hotspot } from '../api';
import { heatColor } from '../api';

function FitBounds({ polyline }: { polyline: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (polyline && polyline.length > 0) {
      map.fitBounds(polyline, { padding: [50, 50] });
    }
  }, [polyline, map]);
  return null;
}

export default function RoutePlanner() {
  const [patrols, setPatrols] = useState(10);
  const [radius, setRadius] = useState(1000);
  const [speed, setSpeed] = useState(25);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  useEffect(() => {
    // Fetch some background hotspots for context
    api.hotspots(200).then(setHotspots).catch(() => {});
  }, []);

  const computeRoute = async () => {
    setLoading(true);
    try {
      const data = await api.route(patrols, radius, speed);
      setRouteData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex h="100%" direction="column" overflow="hidden">
      {/* Header */}
      <Box px={8} py={6} borderBottomWidth="1px" borderColor="gray.700" bg="gray.800">
        <Heading size="lg" mb={1}>Route Planner</Heading>
        <Text color="gray.400" fontSize="sm">Optimal patrol circuit through enforcement hotspots</Text>
      </Box>

      <Flex flex={1} overflow="hidden">
        {/* Left Panel */}
        <Box w="40%" minW="350px" maxW="450px" p={6} overflowY="auto" borderRightWidth="1px" borderColor="gray.700">
          <VStack gap={6} align="stretch">
            {/* Controls */}
            <Box bg="gray.800" borderWidth="1px" borderColor="gray.700" rounded="xl" p={5}>
              <Heading size="sm" mb={4}>Configuration</Heading>
              <VStack gap={5} align="stretch">
                <Box>
                  <Flex justify="space-between" mb={2}>
                    <Text fontSize="sm" color="gray.400">Patrol stops</Text>
                    <Text fontSize="sm" fontWeight="600">{patrols}</Text>
                  </Flex>
                  <input type="range" min={2} max={30} value={patrols} onChange={(e) => setPatrols(parseInt(e.target.value))} style={{ width: '100%' }} />
                </Box>
                <Box>
                  <Flex justify="space-between" mb={2}>
                    <Text fontSize="sm" color="gray.400">Coverage radius</Text>
                    <Text fontSize="sm" fontWeight="600">{radius} m</Text>
                  </Flex>
                  <input type="range" min={200} max={3000} step={100} value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} style={{ width: '100%' }} />
                </Box>
                <Box>
                  <Flex justify="space-between" mb={2}>
                    <Text fontSize="sm" color="gray.400">Avg speed</Text>
                    <Text fontSize="sm" fontWeight="600">{speed} km/h</Text>
                  </Flex>
                  <input type="range" min={5} max={60} step={5} value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} style={{ width: '100%' }} />
                </Box>
                <Button colorScheme="teal" w="100%" onClick={computeRoute} disabled={loading}>
                  {loading ? <Spinner size="sm" /> : "Compute Route"}
                </Button>
              </VStack>
            </Box>

            {/* Results */}
            {routeData ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Box bg="gray.800" borderWidth="1px" borderColor="gray.700" rounded="xl" p={5}>
                  <HStack gap={4} mb={6} justify="space-between">
                    <VStack align="start" gap={0}>
                      <Text fontSize="xs" color="gray.500" textTransform="uppercase">Total Distance</Text>
                      <Text fontSize="2xl" fontWeight="700">{routeData.total_distance_km.toFixed(1)} km</Text>
                    </VStack>
                    <VStack align="start" gap={0}>
                      <Text fontSize="xs" color="gray.500" textTransform="uppercase">Total Time</Text>
                      <Text fontSize="2xl" fontWeight="700">{routeData.total_time_min.toFixed(0)} min</Text>
                    </VStack>
                    <Badge colorScheme={routeData.route_source === 'osrm' ? 'blue' : 'orange'} variant="subtle">
                      {routeData.route_source === 'osrm' ? 'OSRM Routed' : 'Fallback (Haversine)'}
                    </Badge>
                  </HStack>

                  <TableContainer>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th color="gray.400" borderColor="gray.700">#</Th>
                          <Th color="gray.400" borderColor="gray.700">Station</Th>
                          <Th color="gray.400" borderColor="gray.700" isNumeric>Dist (km)</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {routeData.stops.map((s) => (
                          <Tr key={s.order} borderColor="gray.700">
                            <Td borderColor="gray.700"><Badge colorScheme="teal">{s.order}</Badge></Td>
                            <Td borderColor="gray.700">
                              <Text fontWeight="500">{s.station}</Text>
                              <Text fontSize="xs" color="gray.500">{s.recommended_shift}</Text>
                            </Td>
                            <Td borderColor="gray.700" isNumeric fontWeight="600">{s.dist_to_next_km.toFixed(1)}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Box>
              </motion.div>
            ) : (
              <Flex h="200px" align="center" justify="center" bg="gray.800" rounded="xl" borderWidth="1px" borderColor="gray.700">
                <Text color="gray.500">Configure and compute a route</Text>
              </Flex>
            )}
          </VStack>
        </Box>

        {/* Right Panel - Map */}
        <Box flex={1} position="relative">
          <MapContainer
            center={[12.972, 77.594]}
            zoom={12}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            
            {/* Background hotspots */}
            {hotspots.map((h) => (
              <CircleMarker
                key={h.id}
                center={[h.lat, h.lon]}
                radius={2}
                pathOptions={{ color: heatColor(h.cii_normalized), opacity: 0.2, fillOpacity: 0.2 }}
              />
            ))}

            {/* Route Polyline */}
            {routeData?.polyline && (
              <>
                <Polyline 
                  positions={routeData.polyline} 
                  pathOptions={{ color: '#58a6ff', weight: 3, dashArray: '8, 6' }} 
                />
                <FitBounds polyline={routeData.polyline} />
              </>
            )}

            {/* Stops */}
            {routeData?.stops.map((stop) => {
              const icon = L.divIcon({
                className: "patrol-icon",
                html: `<div style="
                  width:28px;height:28px;border-radius:50%;
                  background:#58a6ff;border:2px solid #fff;
                  display:grid;place-items:center;
                  font-size:12px;font-weight:700;color:#000;
                  box-shadow:0 0 12px rgba(88,166,255,0.5);
                ">${stop.order}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              });

              return (
                <Marker key={stop.order} position={[stop.lat, stop.lon]} icon={icon}>
                  <Tooltip>
                    <b>Stop #{stop.order}</b><br/>
                    {stop.station}<br/>
                    {stop.hotspots_covered} hotspots covered
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>
        </Box>
      </Flex>
    </Flex>
  );
}
