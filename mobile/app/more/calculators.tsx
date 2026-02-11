import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, iconSizes } from '../../src/lib/design-tokens';

interface Calculator {
  id: string;
  title: string;
  icon: string;
  description: string;
}

const CALCULATORS: Calculator[] = [
  { id: 'concrete', title: 'Concrete Volume', icon: 'box', description: 'Calculate concrete needed for slabs, footings & paths' },
  { id: 'tile', title: 'Tile Quantity', icon: 'grid', description: 'Estimate tiles needed including wastage' },
  { id: 'paint', title: 'Paint Coverage', icon: 'droplet', description: 'Calculate paint needed for walls & ceilings' },
  { id: 'roof', title: 'Roof Pitch', icon: 'triangle', description: 'Calculate roof pitch angle and ratio' },
  { id: 'baluster', title: 'Baluster Spacing', icon: 'columns', description: 'Calculate baluster count & spacing (AU code)' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  calcCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  calcIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcHeaderText: {
    flex: 1,
  },
  calcTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  calcDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  calcBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultContainer: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resultLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  resultDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  resultTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
});

function ConcreteCalculator({ styles, colors }: { styles: any; colors: ThemeColors }) {
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');

  const l = parseFloat(length) || 0;
  const w = parseFloat(width) || 0;
  const d = parseFloat(depth) || 0;
  const volume = l * w * d;
  const wastage = volume * 0.05;
  const total = volume + wastage;
  const hasResult = l > 0 && w > 0 && d > 0;

  return (
    <View style={styles.calcBody}>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Length (m)</Text>
          <TextInput style={styles.input} value={length} onChangeText={setLength} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Width (m)</Text>
          <TextInput style={styles.input} value={width} onChangeText={setWidth} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Depth (m)</Text>
          <TextInput style={styles.input} value={depth} onChangeText={setDepth} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      {hasResult && (
        <View style={styles.resultContainer}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Volume</Text>
            <Text style={styles.resultValue}>{volume.toFixed(2)} m\u00B3</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Wastage (5%)</Text>
            <Text style={styles.resultValue}>{wastage.toFixed(2)} m\u00B3</Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Total Required</Text>
            <Text style={styles.resultTotal}>{total.toFixed(2)} m\u00B3</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TileCalculator({ styles, colors }: { styles: any; colors: ThemeColors }) {
  const [areaLength, setAreaLength] = useState('');
  const [areaWidth, setAreaWidth] = useState('');
  const [tileLength, setTileLength] = useState('');
  const [tileWidth, setTileWidth] = useState('');
  const [gapWidth, setGapWidth] = useState('3');

  const al = parseFloat(areaLength) || 0;
  const aw = parseFloat(areaWidth) || 0;
  const tl = parseFloat(tileLength) || 0;
  const tw = parseFloat(tileWidth) || 0;
  const gw = parseFloat(gapWidth) || 0;

  const area = al * aw;
  const tileLengthM = (tl + gw / 10) / 100;
  const tileWidthM = (tw + gw / 10) / 100;
  const tileArea = tileLengthM * tileWidthM;
  const tilesNeeded = tileArea > 0 ? Math.ceil(area / tileArea) : 0;
  const withWastage = Math.ceil(tilesNeeded * 1.1);
  const hasResult = al > 0 && aw > 0 && tl > 0 && tw > 0;

  return (
    <View style={styles.calcBody}>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Area Length (m)</Text>
          <TextInput style={styles.input} value={areaLength} onChangeText={setAreaLength} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Area Width (m)</Text>
          <TextInput style={styles.input} value={areaWidth} onChangeText={setAreaWidth} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tile Length (cm)</Text>
          <TextInput style={styles.input} value={tileLength} onChangeText={setTileLength} keyboardType="decimal-pad" placeholder="30" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tile Width (cm)</Text>
          <TextInput style={styles.input} value={tileWidth} onChangeText={setTileWidth} keyboardType="decimal-pad" placeholder="30" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gap (mm)</Text>
          <TextInput style={styles.input} value={gapWidth} onChangeText={setGapWidth} keyboardType="decimal-pad" placeholder="3" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      {hasResult && (
        <View style={styles.resultContainer}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Area</Text>
            <Text style={styles.resultValue}>{area.toFixed(2)} m\u00B2</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Tiles Needed</Text>
            <Text style={styles.resultValue}>{tilesNeeded}</Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>With 10% Wastage</Text>
            <Text style={styles.resultTotal}>{withWastage} tiles</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PaintCalculator({ styles, colors }: { styles: any; colors: ThemeColors }) {
  const [wallHeight, setWallHeight] = useState('');
  const [wallLength, setWallLength] = useState('');
  const [coats, setCoats] = useState('2');
  const [coverage, setCoverage] = useState('12');

  const wh = parseFloat(wallHeight) || 0;
  const wl = parseFloat(wallLength) || 0;
  const c = parseInt(coats) || 1;
  const cov = parseFloat(coverage) || 12;

  const wallArea = wh * wl;
  const totalArea = wallArea * c;
  const litresNeeded = cov > 0 ? Math.ceil(totalArea / cov) : 0;
  const hasResult = wh > 0 && wl > 0;

  return (
    <View style={styles.calcBody}>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wall Height (m)</Text>
          <TextInput style={styles.input} value={wallHeight} onChangeText={setWallHeight} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Wall Length (m)</Text>
          <TextInput style={styles.input} value={wallLength} onChangeText={setWallLength} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Coats</Text>
          <TextInput style={styles.input} value={coats} onChangeText={setCoats} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Coverage (m\u00B2/L)</Text>
          <TextInput style={styles.input} value={coverage} onChangeText={setCoverage} keyboardType="decimal-pad" placeholder="12" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      {hasResult && (
        <View style={styles.resultContainer}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Wall Area</Text>
            <Text style={styles.resultValue}>{wallArea.toFixed(2)} m\u00B2</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Total Area ({c} coat{c > 1 ? 's' : ''})</Text>
            <Text style={styles.resultValue}>{totalArea.toFixed(2)} m\u00B2</Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Paint Required</Text>
            <Text style={styles.resultTotal}>{litresNeeded} litres</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function RoofPitchCalculator({ styles, colors }: { styles: any; colors: ThemeColors }) {
  const [rise, setRise] = useState('');
  const [run, setRun] = useState('');

  const r = parseFloat(rise) || 0;
  const rn = parseFloat(run) || 0;
  const angle = rn > 0 ? Math.atan(r / rn) * (180 / Math.PI) : 0;
  const ratio12 = rn > 0 ? (r / rn) * 12 : 0;
  const hasResult = r > 0 && rn > 0;

  return (
    <View style={styles.calcBody}>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Rise (m)</Text>
          <TextInput style={styles.input} value={rise} onChangeText={setRise} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Run (m)</Text>
          <TextInput style={styles.input} value={run} onChangeText={setRun} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      {hasResult && (
        <View style={styles.resultContainer}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Pitch Angle</Text>
            <Text style={styles.resultValue}>{angle.toFixed(1)}\u00B0</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Pitch Ratio</Text>
            <Text style={styles.resultValue}>{ratio12.toFixed(1)}:12</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function BalusterCalculator({ styles, colors }: { styles: any; colors: ThemeColors }) {
  const [totalLength, setTotalLength] = useState('');
  const [balusterWidth, setBalusterWidth] = useState('');
  const [maxGap, setMaxGap] = useState('125');

  const tl = parseFloat(totalLength) || 0;
  const bw = parseFloat(balusterWidth) || 0;
  const mg = parseFloat(maxGap) || 125;

  const numBalusters = mg + bw > 0 ? Math.ceil((tl + mg) / (bw + mg)) : 0;
  const actualGap = numBalusters > 1 ? (tl - numBalusters * bw) / (numBalusters - 1) : 0;
  const hasResult = tl > 0 && bw > 0 && mg > 0;

  return (
    <View style={styles.calcBody}>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Total Length (mm)</Text>
          <TextInput style={styles.input} value={totalLength} onChangeText={setTotalLength} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Baluster Width (mm)</Text>
          <TextInput style={styles.input} value={balusterWidth} onChangeText={setBalusterWidth} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>
      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Max Gap (mm, AU code)</Text>
          <TextInput style={styles.input} value={maxGap} onChangeText={setMaxGap} keyboardType="decimal-pad" placeholder="125" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }} />
      </View>
      {hasResult && (
        <View style={styles.resultContainer}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Balusters Needed</Text>
            <Text style={styles.resultValue}>{numBalusters}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Actual Gap</Text>
            <Text style={styles.resultValue}>{actualGap.toFixed(1)} mm</Text>
          </View>
          {actualGap > mg && (
            <View style={[styles.resultRow, { marginTop: spacing.xs }]}>
              <Text style={[styles.resultLabel, { color: colors.destructive }]}>Gap exceeds max allowed</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const CALC_COMPONENTS: Record<string, any> = {
  concrete: ConcreteCalculator,
  tile: TileCalculator,
  paint: PaintCalculator,
  roof: RoofPitchCalculator,
  baluster: BalusterCalculator,
};

export default function CalculatorsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Trade Calculators',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {CALCULATORS.map(calc => {
          const isOpen = expanded === calc.id;
          const CalcComponent = CALC_COMPONENTS[calc.id];
          return (
            <View key={calc.id} style={styles.calcCard}>
              <TouchableOpacity
                style={styles.calcHeader}
                onPress={() => toggleExpand(calc.id)}
                activeOpacity={0.7}
              >
                <View style={styles.calcIconContainer}>
                  <Feather name={calc.icon as any} size={iconSizes.lg} color={colors.primary} />
                </View>
                <View style={styles.calcHeaderText}>
                  <Text style={styles.calcTitle}>{calc.title}</Text>
                  <Text style={styles.calcDescription}>{calc.description}</Text>
                </View>
                <Feather
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={iconSizes.xl}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
              {isOpen && CalcComponent && <CalcComponent styles={styles} colors={colors} />}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
