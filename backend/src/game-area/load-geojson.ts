import * as fs from 'fs';
import * as path from 'path';
import { logVerbose } from '../common/verbose-log';

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    megye?: string;
    name?: string;
    [key: string]: any;
  };
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

export interface CountyData {
  name: string;
  polygon: number[][]; // [longitude, latitude][]
}

export function loadCountiesFromGeoJSON(): Record<string, CountyData> {
  const possiblePaths = [
    path.join(__dirname, '../../data/counties.geojson'), // From dist/game-area or src/game-area
    path.join(process.cwd(), 'data/counties.geojson'), // Project root (backend)
  ];
  
  let geojsonPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      geojsonPath = possiblePath;
      break;
    }
  }
  
  if (!geojsonPath) {
    console.warn(`GeoJSON file not found. Tried paths: ${possiblePaths.join(', ')}`);
    return {};
  }
  
  logVerbose(`Loading GeoJSON from: ${geojsonPath}`);

  try {
    const fileContent = fs.readFileSync(geojsonPath, 'utf-8');
    const geojson: GeoJSONData = JSON.parse(fileContent);

    const counties: Record<string, CountyData> = {};

    for (const feature of geojson.features) {
      if (feature.geometry.type !== 'Polygon') {
        continue;
      }

      const countyName = feature.properties.megye || feature.properties.name;
      if (!countyName) {
        continue;
      }

      // GeoJSON coordinates are [longitude, latitude] arrays
      // For Polygon, coordinates[0] is the outer ring
      const coordinates = feature.geometry.coordinates[0];
      
      // Normalize county name to lowercase with hyphens
      const countyCode = countyName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[áéíóöőúüű]/g, (char) => {
          const map: Record<string, string> = {
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ö': 'o', 'ő': 'o',
            'ú': 'u', 'ü': 'u', 'ű': 'u',
          };
          return map[char] || char;
        });

      counties[countyCode] = {
        name: countyName,
        polygon: coordinates,
      };
    }

    logVerbose(`Loaded ${Object.keys(counties).length} counties from GeoJSON`);
    return counties;
  } catch (error) {
    console.error('Error loading GeoJSON file:', error);
    return {};
  }
}

export function loadHungaryBoundaryFromGeoJSON(): number[][] | null {
  const possiblePaths = [
    path.join(__dirname, '../../data/counties.geojson'), // From dist/game-area or src/game-area
    path.join(process.cwd(), 'data/counties.geojson'), // Project root (backend)
  ];
  
  let geojsonPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      geojsonPath = possiblePath;
      break;
    }
  }
  
  if (!geojsonPath) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(geojsonPath, 'utf-8');
    const geojson: GeoJSONData = JSON.parse(fileContent);

    // First, try to find exact "Magyarország" name (case-insensitive)
    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon') {
        const name = feature.properties.megye || feature.properties.name || '';
        // Exact match for "Magyarország" (case-insensitive)
        if (name.toLowerCase() === 'magyarország' || name.toLowerCase() === 'hungary') {
          logVerbose(`Found Hungary boundary with name: "${name}"`);
          return feature.geometry.coordinates[0];
        }
      }
    }

    // If no exact match, try partial match
    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon') {
        const name = feature.properties.megye || feature.properties.name || '';
        if (name.toLowerCase().includes('magyarország') || name.toLowerCase().includes('hungary')) {
          logVerbose(`Found Hungary boundary with partial match: "${name}"`);
          return feature.geometry.coordinates[0];
        }
      }
    }

    // If no explicit Hungary feature, use the largest polygon
    let largestPolygon: number[][] | null = null;
    let maxArea = 0;

    for (const feature of geojson.features) {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0];
        // Simple area calculation (rough estimate)
        const area = coords.length;
        if (area > maxArea) {
          maxArea = area;
          largestPolygon = coords;
        }
      }
    }

    if (largestPolygon) {
      logVerbose('Using largest polygon as Hungary boundary');
    }
    return largestPolygon;
  } catch (error) {
    console.error('Error loading Hungary boundary from GeoJSON:', error);
    return null;
  }
}

