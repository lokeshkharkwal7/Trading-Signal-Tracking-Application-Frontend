import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getSignals, deleteSignal } from "../../services/api";

// Constants
const INITIAL_PAGE = 1;
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
  const [deletingIds, setDeletingIds] = useState(new Set());

  const observerRef = useRef();
  const fetchedPagesRef = useRef(new Set());

  // Fetch signals
  const fetchSignals = useCallback(async (pageNum) => {
    if (loading || fetchedPagesRef.current.has(pageNum)) return;

    try {
      setLoading(true);
      fetchedPagesRef.current.add(pageNum);

      const response = await getSignals(pageNum);
      const { data, pagination } = response;

      setSignals((prev) => {
        const uniqueSignals = new Map(prev.map(signal => [signal._id, signal]));
        data?.forEach(signal => uniqueSignals.set(signal._id, signal));
        return Array.from(uniqueSignals.values());
      });

      setTotalPages(pagination.totalPages);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

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
    if (signals.length === 0 && !loading) {
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
  }, [signals, loading, deletingIds, handleDelete, lastRowRef]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800">
          📊 Trading Dashboard
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {tableHeader}
          {tableBody}
        </table>

        {/* Loading indicator */}
        {loading && signals.length === 0 && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-3 text-gray-500">{LOADING_MESSAGE}</span>
          </div>
        )}

        {/* Loading more indicator */}
        {loading && signals.length > 0 && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-gray-500">Loading more...</span>
          </div>
        )}

        {/* End message */}
        {!loading && page >= totalPages && signals.length > 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">
            {END_MESSAGE}
          </div>
        )}
      </div>
    </div>
  );
}