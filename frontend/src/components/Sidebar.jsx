import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Logo from '../assets/icons/logo.svg';
import InfoIcon from '../assets/icons/info.svg';
import CitySearch from './CitySearch';
import AboutModal from './AboutModal';
import SettingsModal from './SettingsModal';
import AiChatModal from './AiChat/AiChatModal';
import AyaMascot from './AiChat/AyaMascot';
import { groupTimesByDay, parseIsoTimeString, findDefaultTimeIndex } from '../utils/timeUtils';
import '../styles/Sidebar.css';

function Sidebar({
  airData,
  selectedTimeIndex = null,
  referenceDate,
  onSelectTime,
  onTimeSelect,
  viewMode = 'combo',
  onViewModeChange,
  onLocationSelect,
  onCitySelect,
  onOpenAbout,
  onOpenSettings,
  onLocateMe,
  isOpen = false,
  onClose,
  mascotMode = 'mascot',
  activeBaseLayer = 'osm',
  onBaseLayerChange
}) {
  const handleSelectTime = onSelectTime || onTimeSelect;
  const [geoError, setGeoError] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [isGeoErrorVisible, setIsGeoErrorVisible] = useState(false);

  const daysContainerRef = useRef(null);
  const hasInitialScrolledRef = useRef(false);

  const geoErrorTimerRef = useRef(null);
  const geoFadeTimerRef = useRef(null);
  const geoWatchdogRef = useRef(null);
  const geoAttemptIdRef = useRef(0);

  // Очистка всех таймеров ошибки геолокации
  const clearGeoTimers = () => {
    if (geoErrorTimerRef.current) {
      clearTimeout(geoErrorTimerRef.current);
      geoErrorTimerRef.current = null;
    }
    if (geoFadeTimerRef.current) {
      clearTimeout(geoFadeTimerRef.current);
      geoFadeTimerRef.current = null;
    }
  };

  // Страховочный таймер на случай, если браузер не вызвал ни success, ни error
  const clearGeoWatchdog = () => {
    if (geoWatchdogRef.current) {
      clearTimeout(geoWatchdogRef.current);
      geoWatchdogRef.current = null;
    }
  };

  // Очистка таймеров ошибки при размонтировании
  useEffect(() => {
    return () => {
      clearGeoTimers();
      clearGeoWatchdog();
    };
  }, []);

  // Установка ошибки с таймером
  const setGeoErrorWithTimeout = (message) => {
    clearGeoTimers();
    setGeoError(message);
    setIsGeoErrorVisible(true);

    geoErrorTimerRef.current = setTimeout(() => {
      setIsGeoErrorVisible(false);
      geoFadeTimerRef.current = setTimeout(() => {
        setGeoError(null);
        geoFadeTimerRef.current = null;
      }, 300);
      geoErrorTimerRef.current = null;
    }, 4700);
  };


  // Извлечение массива меток времени из airData
  const timeArray = useMemo(() => {
    return Array.isArray(airData?.hourly?.time) ? airData.hourly.time : [];
  }, [airData]);

  // Группировка массива time по суткам (отделение дат от часов)
  const days = useMemo(() => {
    return groupTimesByDay(timeArray, referenceDate);
  }, [timeArray, referenceDate]);

  // Выбранный пользователем день (для переключения списка часов)
  const [selectedDayStr, setSelectedDayStr] = useState(null);

  // Внутреннее состояние выбранного часа на случай неконтролируемого использования
  const [internalTimeIndex, setInternalTimeIndex] = useState(null);
  const activeTimeIndex = selectedTimeIndex !== null && selectedTimeIndex !== undefined
    ? selectedTimeIndex
    : internalTimeIndex;

  // Определение текущего отображаемого дня:
  // 1. Если пользователь явно кликнул на день и он есть в списке
  // 2. Иначе, если выбран час activeTimeIndex — день, содержащий этот час
  // 3. Иначе — сегодняшний день (isToday)
  // 4. Иначе — первый доступный день
  const currentDay = useMemo(() => {
    if (days.length === 0) return null;

    if (selectedDayStr) {
      const found = days.find((d) => d.dateStr === selectedDayStr);
      if (found) return found;
    }

    if (activeTimeIndex !== null && activeTimeIndex !== undefined) {
      const foundFromTime = days.find((d) =>
        d.hours.some((h) => h.index === activeTimeIndex)
      );
      if (foundFromTime) return foundFromTime;
    }

    const todayDay = days.find((d) => d.isToday);
    return todayDay || days[0];
  }, [days, selectedDayStr, activeTimeIndex]);

  // Автоматическая прокрутка к сегодняшнему (или активному) дню при начальной загрузке
  useEffect(() => {
    if (days.length === 0) return;
    if (hasInitialScrolledRef.current) return;

    const scrollContainer = () => {
      const container = daysContainerRef.current;
      const targetCard = container?.querySelector('[data-is-current="true"]') ||
        container?.querySelector('.day-card--active') ||
        container?.querySelector('[data-is-today="true"]');

      if (targetCard) {
        if (container.clientWidth > 0) {
          container.scrollLeft = targetCard.offsetLeft - (container.clientWidth - targetCard.offsetWidth) / 2;
        } else if (typeof targetCard.scrollIntoView === 'function') {
          try {
            targetCard.scrollIntoView({ inline: 'center', block: 'nearest' });
          } catch {
            // ignore
          }
        }
        hasInitialScrolledRef.current = true;
      }
    };

    scrollContainer();
    const frameId = requestAnimationFrame(scrollContainer);
    return () => cancelAnimationFrame(frameId);
  }, [days, currentDay]);

  // Клик по плитке дня: обновляет доступные часы в блоке .times
  const handleDayClick = (dateStr, e) => {
    setSelectedDayStr(dateStr);
    if (e?.currentTarget && typeof e.currentTarget.scrollIntoView === 'function') {
      try {
        e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      } catch {
        // ignore
      }
    }

    const clickedDay = days.find((d) => d.dateStr === dateStr);
    if (clickedDay && clickedDay.hours && clickedDay.hours.length > 0) {
      let targetHour = null;
      if (activeTimeIndex !== null && activeTimeIndex !== undefined && timeArray[activeTimeIndex]) {
        const currentParsed = parseIsoTimeString(timeArray[activeTimeIndex]);
        if (currentParsed) {
          targetHour = clickedDay.hours.find((h) => h.hour === currentParsed.hour);
        }
      }
      if (!targetHour) {
        targetHour = clickedDay.hours[0];
      }
      if (targetHour) {
        handleHourClick(targetHour.index);
      }
    }
  };


  // Индекс времени, наиболее близкого к текущему моменту
  const closestCurrentTimeIndex = useMemo(() => {
    if (!timeArray || timeArray.length === 0) return null;
    return findDefaultTimeIndex(timeArray, referenceDate || new Date());
  }, [timeArray, referenceDate]);

  const isCurrentTimeSelected = activeTimeIndex !== null && activeTimeIndex === closestCurrentTimeIndex;

  // Обработчик выбора ближайшего времени к текущему моменту
  const handleSelectCurrentTime = useCallback(() => {
    if (!timeArray || timeArray.length === 0) return;

    const now = referenceDate || new Date();
    const targetIndex = findDefaultTimeIndex(timeArray, now);
    if (targetIndex === null || targetIndex === undefined || targetIndex < 0) return;

    const targetTimestamp = timeArray[targetIndex];
    const parsed = parseIsoTimeString(targetTimestamp);
    if (parsed) {
      setSelectedDayStr(parsed.dateStr);
    }

    setInternalTimeIndex(targetIndex);
    if (typeof handleSelectTime === 'function') {
      handleSelectTime(targetIndex);
    }

    if (daysContainerRef.current) {
      const container = daysContainerRef.current;
      const targetCard = container.querySelector('[data-is-today="true"]') ||
        container.querySelector('.day-card--today');
      if (targetCard) {
        if (container.clientWidth > 0) {
          container.scrollTo({
            left: targetCard.offsetLeft - (container.clientWidth - targetCard.offsetWidth) / 2,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [timeArray, referenceDate, handleSelectTime]);

  // Клик по плитке часа: вычисляет глобальный selectedTimeIndex и передает его наверх
  const handleHourClick = (globalIndex) => {
    setInternalTimeIndex(globalIndex);
    if (typeof handleSelectTime === 'function') {
      handleSelectTime(globalIndex);
    }
  };


  // Определение приблизительного местоположения по IP (при отсутствии GPS / на небезопасном HTTP)
  const fetchIpLocation = async () => {
    // 1. Собственный бекенд через /api/locate-me (проксируется Vite без проблем с CORS и блокировщиками)
    try {
      const res = await fetch('/api/locate-me');
      if (res.ok) {
        const isFallback = typeof res.headers?.get === 'function'
          && res.headers.get('x-geo-fallback') === '1';
        const data = await res.json();
        if (!isFallback && data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return {
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || ''
          };
        }
      }
    } catch {
      // Игнорируем и пробуем резервный внешний сервис
    }

    // 2. Резервный опрос внешнего сервиса ipwho.is
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return {
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city || ''
          };
        }
      }
    } catch {
      // ignore
    }

    return null;
  };

  // Клик по кнопке местоположения
  const handleLocationClick = async () => {
    // Сброс существующей ошибки и таймеров
    clearGeoTimers();
    clearGeoWatchdog();
    setGeoError(null);
    setIsGeoErrorVisible(false);

    if (typeof onLocateMe === 'function') {
      onLocateMe();
    }

    setIsGeoLoading(true);

    // Идентификатор попытки: защищает от «гонки» GPS и IP-фоллбэка
    const attemptId = ++geoAttemptIdRef.current;
    let finished = false;

    const applyLocationSuccess = (lat, lon, cityName = '') => {
      if (attemptId !== geoAttemptIdRef.current) return;
      finished = true;
      clearGeoWatchdog();
      clearGeoTimers();
      setGeoError(null);
      setIsGeoErrorVisible(false);
      setIsGeoLoading(false);
      if (typeof onLocationSelect === 'function') {
        onLocationSelect(lat, lon, cityName);
      }
      if (typeof onClose === 'function') {
        onClose();
      }
    };

    // Фоллбэк по IP запускается только если GPS недоступен, запрещён или не ответил
    const fallbackToIp = async (gpsErrorMessage) => {
      if (finished || attemptId !== geoAttemptIdRef.current) return;
      finished = true;
      clearGeoWatchdog();

      if (gpsErrorMessage) {
        setGeoErrorWithTimeout(gpsErrorMessage);
        setIsGeoLoading(false);
      }

      const ipLoc = await fetchIpLocation();
      if (attemptId !== geoAttemptIdRef.current) return;

      if (ipLoc) {
        applyLocationSuccess(ipLoc.latitude, ipLoc.longitude, ipLoc.city);
        return;
      }

      setIsGeoLoading(false);
      if (!gpsErrorMessage) {
        setGeoErrorWithTimeout('Не удалось определить местоположение. Попробуйте поиск города.');
      }
    };

    // 1. Всегда сначала пробуем GPS браузера, даже в небезопасном контексте:
    //    если браузер запретит геолокацию — автоматически перейдём на IP.
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      await fallbackToIp('Не удалось определить местоположение. Попробуйте поиск города. Геолокация не поддерживается вашим браузером.');
      return;
    }

    const isInsecure = typeof window !== 'undefined' && window.isSecureContext === false;

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          applyLocationSuccess(position.coords.latitude, position.coords.longitude, '');
        },
        (err) => {
          let message = 'Не удалось определить местоположение.';
          switch (err?.code) {
            case 1:
              message += ' Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.';
              break;
            case 2:
              message += ' Информация о местоположении недоступна.';
              break;
            case 3:
              message += ' Превышено время ожидания ответа от GPS.';
              break;
          }
          if (isInsecure) {
            message += ' Для точной геолокации откройте сайт по HTTPS или на localhost.';
          }
          fallbackToIp(message);
        },
        { timeout: 8000, maximumAge: 0, enableHighAccuracy: true }
      );
    } catch {
      // Некоторые браузеры бросают исключение в небезопасном контексте
      await fallbackToIp(
        isInsecure
          ? 'Геолокация недоступна по HTTP. Для точного определения откройте сайт по HTTPS или на localhost.'
          : 'Не удалось получить доступ к геолокации. Используем приблизительное местоположение по IP.'
      );
      return;
    }

    // 2. Страховка: если браузер не вызвал ни success, ни error
    if (!finished) {
      geoWatchdogRef.current = setTimeout(() => {
        fallbackToIp('Браузер не ответил на запрос геолокации. Используем приблизительное местоположение по IP.');
      }, 9000);
    }
  };

  const sidebarRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const currentTranslateXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const isClosingRef = useRef(false);
  const isTouchActiveRef = useRef(false);
  const didDragRef = useRef(false);
  const dragPointerTypeRef = useRef('');

  // Сброс inline стилей при открытии сайдбара
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      if (sidebarRef.current) {
        sidebarRef.current.style.transform = '';
        sidebarRef.current.style.transition = '';
        sidebarRef.current.classList.remove('sidebar--dragging');
      }
      const backdrop = document.querySelector('.sidebar-backdrop');
      if (backdrop) {
        backdrop.style.opacity = '';
        backdrop.style.transition = '';
      }
    }
  }, [isOpen]);

  // При открытии чата сбрасываем скролл сайдбара, чтобы окно чата не сдвигалось наверх
  useEffect(() => {
    if (isAiChatOpen && sidebarRef.current) {
      sidebarRef.current.scrollTop = 0;
    }
  }, [isAiChatOpen]);

  // Обработка жеста утягивания сайдбара влево (за край, как шторки в мобильных приложениях)
  const startDrag = useCallback((clientX, clientY, target, pointerType = '') => {
    if (!isOpen || isClosingRef.current) return;

    // При открытом чате перетаскивание сайдбара разрешено только за специальный хэндл
    if (isAiChatOpen && !target?.closest?.('.sidebar__drag-handle')) {
      return;
    }

    // С мыши / тачпада на ноутбуках перетаскивание разрешено ТОЛЬКО при целенаправленном захвате хэндла на краю
    if (pointerType === 'mouse' && !target?.closest?.('.sidebar__drag-handle')) {
      return;
    }

    // Не перехватываем жест, если пользователь взаимодействует со слайдером дней, поиском или кнопками закрытия
    if (
      target?.closest?.('.days') ||
      target?.closest?.('input') ||
      target?.closest?.('.sidebar__close-btn') ||
      target?.closest?.('.sidebar__info-btn') ||
      target?.closest?.('.sidebar__settings-btn')
    ) {
      return;
    }

    const isHandle = !!target?.closest?.('.sidebar__drag-handle');
    const isHeader = !!target?.closest?.('.sidebar__header');

    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragStartTimeRef.current = Date.now();
    currentTranslateXRef.current = 0;
    didDragRef.current = false;
    dragPointerTypeRef.current = pointerType;

    if (isHandle || isHeader) {
      isDraggingRef.current = true;
      if (sidebarRef.current) {
        sidebarRef.current.classList.add('sidebar--dragging');
        sidebarRef.current.style.transition = 'none';
      }
    } else {
      isDraggingRef.current = false;
    }
  }, [isOpen]);

  const moveDrag = useCallback((clientX, clientY, e) => {
    if (!isOpen || isClosingRef.current) return;
    const deltaX = clientX - dragStartXRef.current;
    const deltaY = clientY - dragStartYRef.current;

    if (!isDraggingRef.current) {
      // Для указателя мыши/тачпада запрещаем автозахват из контента
      if (dragPointerTypeRef.current === 'mouse') {
        return;
      }
      // Начинаем drag, если движение явно горизонтальное влево
      if (deltaX < -6 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isDraggingRef.current = true;
        dragStartXRef.current = clientX;
        if (sidebarRef.current) {
          sidebarRef.current.classList.add('sidebar--dragging');
          sidebarRef.current.style.transition = 'none';
        }
      } else if (Math.abs(deltaY) > 8) {
        // Вертикальный скролл списка сайдбара - не перехватываем
        return;
      }
    }

    if (isDraggingRef.current) {
      if (e?.cancelable) {
        e.preventDefault?.();
      }
      didDragRef.current = true;
      const sidebar = sidebarRef.current;
      if (!sidebar) return;

      let translateX = 0;
      if (deltaX <= 0) {
        translateX = deltaX;
      } else {
        // Резиновое сопротивление при попытке тянуть вправо
        translateX = deltaX * 0.1;
      }

      currentTranslateXRef.current = translateX;
      sidebar.style.transform = `translateX(${translateX}px)`;

      // Синхронное затухание затемняющего бэкдропа
      const backdrop = document.querySelector('.sidebar-backdrop');
      if (backdrop) {
        const width = sidebar.offsetWidth || 300;
        const progress = Math.max(0, Math.min(1, 1 - Math.abs(translateX) / width));
        backdrop.style.opacity = String(progress);
      }
    }
  }, [isOpen]);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = false;

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    sidebar.classList.remove('sidebar--dragging');

    const deltaX = currentTranslateXRef.current;
    const elapsed = Math.max(1, Date.now() - dragStartTimeRef.current);
    const velocityX = deltaX / elapsed;
    const sidebarWidth = sidebar.offsetWidth || 300;
    const threshold = Math.min(90, Math.max(50, sidebarWidth * 0.22));

    const shouldClose = deltaX < -threshold || (velocityX < -0.35 && deltaX < -20);
    const backdrop = document.querySelector('.sidebar-backdrop');
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    const closeDelay = isTest ? 30 : 220;

    if (shouldClose) {
      isClosingRef.current = true;
      sidebar.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
      sidebar.style.transform = 'translateX(-100%)';
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.22s ease';
        backdrop.style.opacity = '0';
      }

      const timerId = setTimeout(() => {
        if (typeof onClose === 'function') {
          onClose();
        }
        if (sidebar) {
          sidebar.style.transition = '';
          sidebar.style.transform = '';
        }
        if (backdrop) {
          backdrop.style.transition = '';
          backdrop.style.opacity = '';
        }
        isClosingRef.current = false;
      }, closeDelay);
      return () => clearTimeout(timerId);
    } else {
      sidebar.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      sidebar.style.transform = 'translateX(0)';
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.2s ease';
        backdrop.style.opacity = '1';
      }
      const resetTimer = setTimeout(() => {
        if (sidebar && !isClosingRef.current) {
          sidebar.style.transition = '';
          sidebar.style.transform = '';
        }
        if (backdrop && !isClosingRef.current) {
          backdrop.style.transition = '';
          backdrop.style.opacity = '';
        }
      }, 200);
      return () => clearTimeout(resetTimer);
    }
  }, [onClose]);

  const onTouchStart = (e) => {
    isTouchActiveRef.current = true;
    const touch = e.touches?.[0];
    if (touch) {
      startDrag(touch.clientX, touch.clientY, e.target);
    }
  };

  const onTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (touch) {
      moveDrag(touch.clientX, touch.clientY, e);
    }
  };

  const onTouchEnd = () => {
    setTimeout(() => {
      isTouchActiveRef.current = false;
    }, 100);
    endDrag();
  };

  const onTouchCancel = () => {
    setTimeout(() => {
      isTouchActiveRef.current = false;
    }, 100);
    endDrag();
  };

  const onPointerDown = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.button !== undefined && e.button !== 0) return;

    // С мыши / тачпада на ноутбуках перетаскивание разрешено ТОЛЬКО за специальный хэндл на краю
    if (e.pointerType === 'mouse' && !e.target?.closest?.('.sidebar__drag-handle')) {
      return;
    }

    if (e.target && typeof e.target.setPointerCapture === 'function') {
      try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    startDrag(e.clientX, e.clientY, e.target, e.pointerType);
  };

  const onPointerMove = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.pointerType === 'mouse' && !isDraggingRef.current) return;
    moveDrag(e.clientX, e.clientY, e);
  };

  const onPointerUp = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.target && typeof e.target.releasePointerCapture === 'function') {
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    endDrag();
  };

  const onPointerCancel = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.target && typeof e.target.releasePointerCapture === 'function') {
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    endDrag();
  };

  const onClickCapture = (e) => {
    if (didDragRef.current) {
      e.stopPropagation();
      e.preventDefault();
      didDragRef.current = false;
    }
  };

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar ${isOpen ? 'sidebar--open' : ''} ${isAiChatOpen ? 'sidebar--chat-open' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      {/* Декоративный хэндл для удобного перетаскивания мобильного сайдбара за правый край */}
      <div
        className="sidebar__drag-handle"
        data-testid="sidebar-drag-handle"
        aria-label="Потяните влево, чтобы закрыть меню"
        tabIndex={-1}
      />
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <img src={Logo} alt="AeroCast" className="sidebar__logo" />
          <div className="sidebar__title">Aerocast</div>
        </div>
        <div className="sidebar__header-actions">
          <button
            type="button"
            className="sidebar__settings-btn"
            aria-label="Настройки"
            title="Настройки"
            data-testid="sidebar-settings-btn"
            onClick={(e) => {
              e.preventDefault();
              if (typeof onOpenSettings === 'function') {
                onOpenSettings();
              } else {
                setIsSettingsOpen(true);
              }
            }}
          >
            <svg
              className="sidebar__settings-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <a
            href="#"
            className="sidebar__info-btn"
            aria-label="Информация о проекте"
            onClick={(e) => {
              e.preventDefault();
              if (typeof onClose === 'function') {
                onClose();
              }
              if (typeof onOpenAbout === 'function') {
                onOpenAbout();
              } else {
                setIsAboutOpen(true);
              }
            }}
          >
            <img src={InfoIcon} className="sidebar__info-icon" alt="" />
          </a>
          {typeof onClose === 'function' && (
            <button
              type="button"
              className="sidebar__close-btn"
              aria-label="Закрыть меню"
              onClick={onClose}
            >
              &times;
            </button>
          )}
        </div>
      </div>


      <CitySearch
        onLocationSelect={(loc) => {
          if (typeof onLocationSelect === 'function') {
            if (onLocationSelect.length > 1) {
              onLocationSelect(loc.lat, loc.lon, loc.name);
            } else {
              onLocationSelect(loc);
            }
          }
          if (typeof onCitySelect === 'function') {
            onCitySelect(loc);
          }
        }}
        onCitySelect={onCitySelect}
      />

      <section className="display-mode">
        <h2 className="display-mode__title">Режим отображения</h2>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__btn ${viewMode === 'numeric' ? 'segmented__btn--active' : ''}`}
            onClick={() => onViewModeChange?.('numeric')}
          >
            Цифровой
          </button>
          <button
            type="button"
            className={`segmented__btn ${viewMode === 'color' ? 'segmented__btn--active' : ''}`}
            onClick={() => onViewModeChange?.('color')}
          >
            Цветовой
          </button>
          <button
            type="button"
            className={`segmented__btn ${(!viewMode || viewMode === 'combo') ? 'segmented__btn--active' : ''}`}
            onClick={() => onViewModeChange?.('combo')}
          >
            Комбо
          </button>
        </div>
      </section>

      <section className="geo-nav">
        <h2 className="geo-nav__title">Навигация</h2>
        <button type="button" className="geo-nav__location-btn" onClick={handleLocationClick} disabled={isGeoLoading}>
          {isGeoLoading ? 'Определяем...' : 'Моё местоположение'}
        </button>
        {geoError && (
          <div className={`geo-nav__error ${isGeoErrorVisible ? 'geo-nav__error-fadein' : 'geo-nav__error-fadeout'}`}>
            ⚠️ {geoError}
          </div>
        )}
      </section>

      <section className="date-nav">
        <h2 className="date-nav__title">Навигация по времени</h2>
        <div className="days" ref={daysContainerRef}>
          {days.length === 0 ? (
            <span className="time-nav__empty">Нет данных о датах</span>
          ) : (
            days.map((day) => {
              const isDayActive = currentDay?.dateStr === day.dateStr;
              const cardClasses = [
                'day-card',
                day.isForecast ? 'day-card--forecast' : '',
                day.isToday ? 'day-card--today' : '',
                isDayActive ? 'day-card--active' : ''
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={day.dateStr}
                  className={cardClasses}
                  type="button"
                  onClick={(e) => handleDayClick(day.dateStr, e)}
                  title={day.dateStr}
                  data-is-current={isDayActive ? 'true' : undefined}
                  data-is-today={day.isToday ? 'true' : undefined}
                >
                  <span className="day-card__label">{day.dayOfWeek}</span>
                  <span className="day-card__num">{day.dayOfMonth}</span>
                  {day.isToday && <span className="day-card__extra">сег</span>}
                  {!day.isToday && day.isForecast && (
                    <span className="day-card__extra">прог</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <button
          type="button"
          className={`date-nav__now-btn ${isCurrentTimeSelected ? 'date-nav__now-btn--active' : ''}`}
          onClick={handleSelectCurrentTime}
          title="Выбрать ближайшее время к текущему"
          data-testid="select-current-time-btn"
        >
          <svg
            className="date-nav__now-icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Выбрать текущее время</span>
        </button>
      </section>

      <section className="time-nav">
        <h2 className="time-nav__title">Время суток</h2>
        <div className="times">
          {!currentDay || currentDay.hours.length === 0 ? (
            <span className="time-nav__empty">Нет доступных часов</span>
          ) : (
            currentDay.hours.map((hourItem) => {
              const isHourActive = hourItem.index === activeTimeIndex;
              const timeClasses = [
                'time',
                isHourActive ? 'time--active' : ''
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={hourItem.timeStr}
                  className={timeClasses}
                  type="button"
                  onClick={() => handleHourClick(hourItem.index)}
                >
                  {hourItem.timeLabel}
                </button>
              );
            })
          )}
        </div>
      </section>

      {isAiChatOpen ? (
        <div className="sidebar-chat-active-container" data-testid="sidebar-chat-active-container">
          <AiChatModal
            isOpen={true}
            onClose={() => setIsAiChatOpen(false)}
            onOpenSettings={() => {
              if (typeof onOpenSettings === 'function') onOpenSettings();
              else setIsSettingsOpen(true);
            }}
            embedded={true}
            mascotUnderChat={mascotMode === 'mascot'}
            activeBaseLayer={activeBaseLayer}
            onBaseLayerChange={onBaseLayerChange}
          />
        </div>
      ) : mascotMode === 'button' ? (
        <button
          type="button"
          className="sidebar-ai-chat-trigger"
          onClick={() => setIsAiChatOpen(true)}
          title='Открыть чат с AI-маскотом "Ая" (AnyModel)'
          data-testid="open-ai-chat-btn"
        >
          <div className="sidebar-ai-chat-trigger__left">
            <span className="sidebar-ai-chat-trigger__icon" aria-hidden="true">
              💬
            </span>
            <span>Чат с Аей</span>
          </div>
        </button>
      ) : (
        <div className="sidebar-mascot-container" data-testid="sidebar-mascot-container">
          <AyaMascot
            emotion="idle"
            size="sidebar"
            onClick={() => setIsAiChatOpen(true)}
          />
        </div>
      )}

      {!onOpenAbout && (
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
        />
      )}
      {!onOpenSettings && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </aside>
  );
}

export default Sidebar;
