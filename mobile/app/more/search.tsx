import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet,
  ActivityIndicator 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, typography, iconSizes, sizes } from '../../src/lib/design-tokens';
import { useJobsStore, useClientsStore, useQuotesStore, useInvoicesStore } from '../../src/lib/store';

interface SearchResult {
  id: string;
  type: 'job' | 'client' | 'quote' | 'invoice';
  title: string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  onPress: () => void;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    padding: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.md,
    color: colors.foreground,
    fontSize: 16,
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  loading: {
    paddingVertical: spacing['3xl'],
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultIcon: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  resultTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  resultSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs / 2,
  },
  resultType: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  resultTypeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyText: {
    ...typography.sectionTitle,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
});

export default function SearchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { jobs } = useJobsStore();
  const { clients } = useClientsStore();
  const { quotes } = useQuotesStore();
  const { invoices } = useInvoicesStore();

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const lowerQuery = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    jobs.forEach(job => {
      if (
        job.title.toLowerCase().includes(lowerQuery) ||
        job.address?.toLowerCase().includes(lowerQuery)
      ) {
        searchResults.push({
          id: job.id,
          type: 'job',
          title: job.title,
          subtitle: job.address,
          icon: 'briefcase',
          iconColor: colors.primary,
          onPress: () => router.push(`/job/${job.id}`)
        });
      }
    });

    clients.forEach(client => {
      if (
        client.name.toLowerCase().includes(lowerQuery) ||
        client.email?.toLowerCase().includes(lowerQuery) ||
        client.phone?.includes(lowerQuery)
      ) {
        searchResults.push({
          id: client.id,
          type: 'client',
          title: client.name,
          subtitle: client.email || client.phone,
          icon: 'user',
          iconColor: colors.info,
          onPress: () => router.push(`/more/client/${client.id}`)
        });
      }
    });

    quotes.forEach(quote => {
      if (
        quote.quoteNumber?.toLowerCase().includes(lowerQuery) ||
        quote.clientName?.toLowerCase().includes(lowerQuery)
      ) {
        searchResults.push({
          id: quote.id,
          type: 'quote',
          title: `Quote #${quote.quoteNumber}`,
          subtitle: quote.clientName,
          icon: 'file-text',
          iconColor: colors.warning,
          onPress: () => router.push(`/more/quote/${quote.id}`)
        });
      }
    });

    invoices.forEach(invoice => {
      if (
        invoice.invoiceNumber?.toLowerCase().includes(lowerQuery) ||
        invoice.clientName?.toLowerCase().includes(lowerQuery)
      ) {
        searchResults.push({
          id: invoice.id,
          type: 'invoice',
          title: `Invoice #${invoice.invoiceNumber}`,
          subtitle: invoice.clientName,
          icon: 'dollar-sign',
          iconColor: colors.success,
          onPress: () => router.push(`/more/invoice/${invoice.id}`)
        });
      }
    });

    setResults(searchResults.slice(0, 20));
    setIsSearching(false);
  }, [jobs, clients, quotes, invoices, colors]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Search',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={iconSizes.lg} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs, clients, quotes..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={iconSizes.lg} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}
      >
        {isSearching ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : results.length > 0 ? (
          results.map((result) => (
            <TouchableOpacity
              key={`${result.type}-${result.id}`}
              style={styles.resultItem}
              onPress={result.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.resultIcon, { backgroundColor: `${result.iconColor}15` }]}>
                <Feather name={result.icon} size={iconSizes.lg} color={result.iconColor} />
              </View>
              <View style={styles.resultContent}>
                <Text style={styles.resultTitle}>{result.title}</Text>
                {result.subtitle && (
                  <Text style={styles.resultSubtitle} numberOfLines={1}>{result.subtitle}</Text>
                )}
              </View>
              <View style={styles.resultType}>
                <Text style={styles.resultTypeText}>{result.type}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : query.length > 0 ? (
          <View style={styles.empty}>
            <Feather name="search" size={sizes.emptyIcon} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Feather name="search" size={sizes.emptyIcon} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>Start typing to search</Text>
            <Text style={styles.emptySubtext}>Search for jobs, clients, quotes, or invoices</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
