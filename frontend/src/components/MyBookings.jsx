// src/pages/MyBookings.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FaCar,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaFilter,
  FaTimes,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaUser,
  FaCreditCard,
  FaReceipt,
  FaArrowRight,
} from "react-icons/fa";
import { myBookingsStyles as s } from "../assets/dummyStyles";

const API_BASE = "http://localhost:5000";
const TIMEOUT = 15000;

// ---------- Helpers ----------
const safeAccess = (fn, fallback = "") => {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return Number.isNaN(d.getTime())
    ? String(dateString)
    : d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const formatPrice = (price) => {
  const num = typeof price === "number" ? price : Number(price) || 0;
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const daysBetween = (start, end) => {
  try {
    const a = new Date(start);
    const b = new Date(end);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

// ---------- Normalize booking ----------
const normalizeBooking = (booking) => {
  const carObj = booking.car || {};
  const address = booking.address || {};
  const pickupDate = booking.pickupDate || booking.dates?.pickup || booking.pickup;
  const returnDate = booking.returnDate || booking.dates?.return || booking.return;

  // Determine status correctly
  let status = booking.status || booking.paymentStatus || "pending";
  const now = new Date();
  const returnD = new Date(returnDate);
  if (status === "active") {
    status = returnD >= now ? "upcoming" : "completed";
  } else if (status !== "pending" && status !== "cancelled" && status !== "completed") {
    status = returnD >= now ? "upcoming" : "completed";
  }

  return {
    id: booking._id || booking.id || String(Math.random()).slice(2, 8),
    car: {
      make: carObj.make || carObj.name || "Unnamed Car",
      image: safeAccess(() => booking.carImage) || safeAccess(() => carObj.image) || "https://via.placeholder.com/800x450.png?text=No+Image",
      year: carObj.year || carObj.modelYear || "",
      category: carObj.category || "",
      seats: booking.details?.seats || carObj.seats || 4,
      transmission: booking.details?.transmission || carObj.transmission || carObj.gearbox || "",
      fuelType: booking.details?.fuelType || carObj.fuelType || carObj.fuel || carObj.fuel_type || "",
      mileage: booking.details?.mileage || carObj.mileage || carObj.kmpl || carObj.mpg || "",
    },
    user: {
      name: booking.customer || safeAccess(() => booking.user?.name) || "Guest",
      email: booking.email || safeAccess(() => booking.user?.email) || "",
      phone: booking.phone || safeAccess(() => booking.user?.phone) || "",
      address: address.street || address.city || address.state
        ? `${address.street || ""}${address.city ? ", " + address.city : ""}${address.state ? ", " + address.state : ""}`
        : safeAccess(() => booking.user?.address) || "",
    },
    dates: { pickup: pickupDate, return: returnDate },
    location: address.city || booking.location || carObj.location || "Pickup location",
    price: Number(booking.amount || booking.price || booking.total || 0),
    status,
    bookingDate: booking.bookingDate || booking.createdAt || booking.updatedAt || Date.now(),
    paymentMethod: booking.paymentMethod || booking.payment?.method || "",
    paymentId: booking.paymentIntentId || booking.paymentId || booking.sessionId || "",
    raw: booking,
  };
};

// ---------- Components ----------
const FilterButton = ({ filterKey, currentFilter, icon, label, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(filterKey)}
    className={s.filterButton(currentFilter === filterKey, filterKey)}
  >
    {icon} {label}
  </button>
);

const StatusBadge = ({ status }) => {
  const map = {
    completed: { text: "Completed", color: "bg-green-500", icon: <FaCheckCircle /> },
    upcoming: { text: "Upcoming", color: "bg-blue-500", icon: <FaClock /> },
    cancelled: { text: "Cancelled", color: "bg-red-500", icon: <FaTimesCircle /> },
    pending: { text: "Pending", color: "bg-yellow-500", icon: <FaClock /> },
    default: { text: "Unknown", color: "bg-gray-500", icon: null },
  };
  const { text, color, icon } = map[status] || map.default;
  return (
    <div className={`${color} text-white px-3 py-1 rounded-full inline-flex items-center gap-2 text-sm`}>
      {icon}
      <span>{text}</span>
    </div>
  );
};

const BookingCard = ({ booking, onViewDetails }) => {
  const days = daysBetween(booking.dates.pickup, booking.dates.return);
  return (
    <div className={s.bookingCard}>
      <div className={s.cardImageContainer}>
        <img src={booking.car.image} alt={booking.car.make} className={s.cardImage} />
      </div>
      <div className={s.cardContent}>
        <div className={s.cardHeader}>
          <div>
            <h3 className={s.carTitle}>{booking.car.make}</h3>
            <p className={s.carSubtitle}>
              {booking.car.category} • {booking.car.year}
            </p>
          </div>
          <div className="text-right">
            <p className={s.priceText}>{formatPrice(booking.price)}</p>
            <p className={s.daysText}>for {days} {days > 1 ? "days" : "day"}</p>
          </div>
        </div>
        <StatusBadge status={booking.status} />
        <div className={s.detailSection}>
          <div className={s.detailItem}>
            <div className={s.detailIcon}><FaCalendarAlt /></div>
            <div>
              <p className={s.detailLabel}>Dates</p>
              <p className={s.detailValue}>
                {formatDate(booking.dates.pickup)} - {formatDate(booking.dates.return)}
              </p>
            </div>
          </div>
          <div className={s.detailItem}>
            <div className={s.detailIcon}><FaMapMarkerAlt /></div>
            <div>
              <p className={s.detailLabel}>Pickup Location</p>
              <p className={s.detailValue}>{booking.location}</p>
            </div>
          </div>
        </div>
        <div className={s.cardActions}>
          <button type="button" onClick={() => onViewDetails(booking)} className={s.viewDetailsButton}>
            <FaReceipt /> View Details
          </button>
          <Link to="/cars" className={s.bookAgainButton}>
            <FaCar /> {booking.status === "upcoming" ? "Modify" : "Book Again"}
          </Link>
        </div>
      </div>
    </div>
  );
};

// ---------- Main Page ----------
const StatsCard = ({ value, label, color }) => (
  <div className={s.statsCard}>
    <div className={s.statsValue(color)}>{value}</div>
    <p className={s.statsLabel}>{label}</p>
  </div>
);

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };

      const res = await axios.get(`${API_BASE}/api/bookings/mybooking`, { headers, signal: controller.signal });
      const rawData = Array.isArray(res.data) ? res.data : res.data?.bookings || res.data?.data || [];
      setBookings(rawData.map(normalizeBooking));
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load bookings");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, []);

  const cancelBooking = useCallback(async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };
      const res = await axios.patch(`${API_BASE}/api/bookings/${bookingId}/status`, { status: "cancelled" }, { headers });
      const updated = normalizeBooking(res.data || { _id: bookingId, status: "cancelled" });
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
      if (selectedBooking?.id === bookingId) setSelectedBooking(updated);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to cancel booking");
    }
  }, [selectedBooking]);

  const filteredBookings = useMemo(() =>
    filter === "all" ? bookings : bookings.filter(b => b.status === filter),
    [bookings, filter]
  );

  const filterButtons = [
    { key: "all", label: "All Bookings", icon: <FaFilter /> },
    { key: "upcoming", label: "Upcoming", icon: <FaClock /> },
    { key: "completed", label: "Completed", icon: <FaCheckCircle /> },
    { key: "cancelled", label: "Cancelled", icon: <FaTimes /> },
    { key: "pending", label: "Pending", icon: <FaClock /> },
  ];

  const openDetails = (b) => { setSelectedBooking(b); setShowModal(true); };
  const closeModal = () => { setSelectedBooking(null); setShowModal(false); };

  return (
    <div className={s.pageContainer + " pt-28"}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className={s.title}>My Bookings</h1>
          <p className={s.subtitle}>View and manage all your current and past car rental bookings</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {filterButtons.map(btn => (
            <FilterButton key={btn.key} filterKey={btn.key} currentFilter={filter} icon={btn.icon} label={btn.label} onClick={setFilter} />
          ))}
        </div>

        {loading && <div className="flex justify-center items-center py-20"><div className={s.loadingSpinner} /></div>}
        {!loading && error && <div className={s.errorContainer}><p className={s.errorText}>{error}</p><button type="button" onClick={fetchBookings} className={s.retryButton}>Retry</button></div>}

        {!loading && !error && filteredBookings.length === 0 && (
          <div className={s.emptyState}>
            <div className={s.emptyIconContainer}><FaCar className={s.emptyIcon} /></div>
            <h3 className={s.emptyTitle}>No bookings found</h3>
            <p className={s.emptyText}>{filter === "all" ? "You haven't made any bookings yet. Browse our collection to get started!" : `You don't have any ${filter} bookings.`}</p>
            <Link to="/cars" className={s.browseButton}><FaCar /> Browse Cars</Link>
          </div>
        )}

        {!loading && !error && filteredBookings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookings.map(b => <BookingCard key={b.id} booking={b} onViewDetails={openDetails} />)}
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard value={bookings.length} label="Total Bookings" color="text-orange-400" />
          <StatsCard value={bookings.filter(b => b.status === "completed").length} label="Completed Trips" color="text-green-400" />
          <StatsCard value={bookings.filter(b => b.status === "upcoming").length} label="Upcoming Trips" color="text-blue-400" />
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={closeModal} onCancel={cancelBooking} />
      )}
    </div>
  );
};

export default MyBookings;
