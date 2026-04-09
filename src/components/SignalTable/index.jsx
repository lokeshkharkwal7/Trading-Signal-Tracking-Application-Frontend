import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getSignals, deleteSignal } from "../../services/api";

// Constants
const INITIAL_PAGE = 1;
const REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
const EMPTY_STATE_MESSAGE = "No signals found";
const LOADING_MESSAGE = "Loading signals...";
const END_MESSAGE = "No more signals";

const StatusBadge = ({ status }) => (
  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
    {status}
  </span>
);

const DirectionIndicator = ({ direction }) => (
  <span className={`font-semibold ${direction === "BUY" ? "text-green-600" : "text-red-600"}`}>
    {direction}
  </span>
);

// Table header configuration with proper alignment
const TABLE_COLUMNS = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "direction", label: "Dir", align: "center" },
  { key: "entry_price", label: "Entry", align: "right" },
  { key: "target_price", label: "Target", align: "right" },
  { key: "stop_loss", label: "SL", align: "right" },
  { key: "current_price", label: "Current", align: "right" },
  { key: "status", label: "Status", align: "center" },
  { key: "roi", label: "ROI", align: "right" },
  { key: "actions", label: "Action", align: "center" },
];

export default function SignalTable() {
  const [signals, setSignals] = useState([]);
  const [page, setPage] = useState(INITIAL_PAGE);
  const [totalPages, setTotalPages] = useState(INITIAL_PAGE);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  const observerRef = useRef();
  const fetchedPagesRef = useRef(new Set());
  const intervalRef = useRef(null);

  // Fetch signals
  const fetchSignals = useCallback(async (pageNum, isRefresh = false) => {
    if (loading || (!isRefresh && fetchedPagesRef.current.has(pageNum))) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      if (!isRefresh) {
        fetchedPagesRef.current.add(pageNum);
      }

      const response = await getSignals(pageNum);
      const { data, pagination } = response;

      if (isRefresh) {
        // On refresh, replace all data
        setSignals(data || []);
        setTotalPages(pagination.totalPages);
        setPage(INITIAL_PAGE);
        // Clear fetched pages cache
        fetchedPagesRef.current.clear();
        fetchedPagesRef.current.add(INITIAL_PAGE);
      } else {
        // On pagination, append data
        setSignals((prev) => {
          const uniqueSignals = new Map(prev.map(signal => [signal._id, signal]));
          data?.forEach(signal => uniqueSignals.set(signal._id, signal));
          return Array.from(uniqueSignals.values());
        });
        setTotalPages(pagination.totalPages);
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  // Refresh all data (reset and fetch from page 1)
  const refreshData = useCallback(async () => {
    if (refreshing) return;
    
    // Reset everything
    setSignals([]);
    setPage(INITIAL_PAGE);
    setTotalPages(INITIAL_PAGE);
    fetchedPagesRef.current.clear();
    
    // Fetch fresh data
    await fetchSignals(INITIAL_PAGE, true);
  }, [fetchSignals, refreshing]);

  // Delete signal
  const handleDelete = useCallback(async (id) => {
    setSignals(prev => prev.filter(signal => signal._id !== id));
    setDeletingIds(prev => new Set(prev).add(id));

    try {
      await deleteSignal(id);
      setSignals([]);
      setPage(INITIAL_PAGE);
      setTotalPages(INITIAL_PAGE);
      fetchedPagesRef.current.clear();
      await fetchSignals(INITIAL_PAGE);
    } catch (err) {
      console.error("Delete error:", err);
      setSignals([]);
      setPage(INITIAL_PAGE);
      setTotalPages(INITIAL_PAGE);
      fetchedPagesRef.current.clear();
      await fetchSignals(INITIAL_PAGE);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, [fetchSignals]);

  // Infinite scroll observer
  const lastRowRef = useCallback((node) => {
    if (loading || page >= totalPages) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && page < totalPages) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (node) observerRef.current.observe(node);
  }, [loading, page, totalPages]);

  // Fetch on page change
  useEffect(() => {
    fetchSignals(page);
  }, [page, fetchSignals]);

  // Setup auto-refresh interval
  useEffect(() => {
    // Start interval
    intervalRef.current = setInterval(() => {
      refreshData();
    }, REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshData]);

  // Cleanup observer
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // Get alignment class for cells
  const getAlignClass = (align) => {
    switch(align) {
      case 'right': return 'text-right';
      case 'center': return 'text-center';
      default: return 'text-left';
    }
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    return lastUpdated.toLocaleTimeString();
  };

  // Memoized table header
  const tableHeader = useMemo(() => (
    <thead>
      <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs">
        {TABLE_COLUMNS.map(column => (
          <th 
            key={column.key} 
            className={`p-3 ${getAlignClass(column.align)}`}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  ), []);

  // Memoized table body
  const tableBody = useMemo(() => {
    if (signals.length === 0 && !loading && !refreshing) {
      return (
        <tbody>
          <tr>
            <td colSpan={TABLE_COLUMNS.length} className="text-center py-12 text-gray-400">
              {EMPTY_STATE_MESSAGE}
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody>
        {signals.map((signal, index) => {
          const isLastRow = index === signals.length - 1;
          const isDeleting = deletingIds.has(signal._id);
          
          return (
            <tr
              key={signal._id}
              ref={isLastRow ? lastRowRef : null}
              className={`border-b hover:bg-gray-50 transition-colors duration-150 ${
                isDeleting ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <td className="p-3 font-medium text-gray-800 text-left">{signal.symbol}</td>
              <td className="p-3 text-center">
                <DirectionIndicator direction={signal.direction} />
              </td>
              <td className="p-3 text-right">{signal.entry_price}</td>
              <td className="p-3 text-right text-green-600 font-medium">{signal.target_price}</td>
              <td className="p-3 text-right text-red-500 font-medium">{signal.stop_loss}</td>
              <td className="p-3 font-semibold text-gray-700 text-right">{signal.current_price}</td>
              <td className="p-3 text-center"><StatusBadge status={signal.status} /></td>
              <td className={`p-3 font-semibold text-right ${signal.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                {signal.roi}%
              </td>
              <td className="p-3 text-center">
                <button
                  onClick={() => handleDelete(signal._id)}
                  disabled={isDeleting}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Delete ${signal.symbol} signal`}
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    );
  }, [signals, loading, refreshing, deletingIds, handleDelete, lastRowRef]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3">
      <div className="p-6 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              📊 Trading Dashboard
            </h2>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">
                Last updated: {formatLastUpdated()}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>Auto-refresh (1min)</span>
            </div>
            
            {/* Refresh button */}
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh data"
            >
              <svg 
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {tableHeader}
          {tableBody}
        </table>

        {/* Loading indicator */}
        {(loading || refreshing) && signals.length === 0 && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-3 text-gray-500">{refreshing ? 'Refreshing...' : LOADING_MESSAGE}</span>
          </div>
        )}

        {/* Loading more indicator */}
        {loading && signals.length > 0 && !refreshing && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-gray-500">Loading more...</span>
          </div>
        )}

        {/* Refresh overlay for smooth UX */}
        {refreshing && signals.length > 0 && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              <span className="text-sm text-gray-700">Updating prices...</span>
            </div>
          </div>
        )}

        {/* End message */}
        {!loading && !refreshing && page >= totalPages && signals.length > 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            {END_MESSAGE}
          </div>
        )}
      </div>
    </div>
  );
}