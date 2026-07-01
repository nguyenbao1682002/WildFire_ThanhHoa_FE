import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface FaqItem {
  q: string
  a: string
  tags: string[]
}

interface Category {
  id: string
  label: string
  icon: string
  items: FaqItem[]
}

const CATEGORIES_VI: Category[] = [
  {
    id: 'map',
    label: 'Bản đồ',
    icon: 'map',
    items: [
      {
        q: 'Làm thế nào để chuyển nền bản đồ?',
        a: 'Vào trang Bản đồ → panel "Lớp bản đồ" ở góc trái → chọn "Tối", "Sáng" hoặc "Địa lý" trong mục Nền bản đồ.',
        tags: ['bản đồ', 'nền', 'basemap'],
      },
      {
        q: 'Công cụ Đến tọa độ dùng như thế nào?',
        a: 'Bấm nút "Đến tọa độ" trên thanh công cụ → nhập vĩ độ (Lat), kinh độ (Lng) và mức zoom → bấm "Bay đến vị trí". Tọa độ tham khảo trung tâm Thanh Hóa: 19.8°N, 105.78°E.',
        tags: ['tọa độ', 'goto', 'điều hướng'],
      },
      {
        q: 'Đo khoảng cách trên bản đồ bằng cách nào?',
        a: 'Bấm "Đo khoảng cách" → click từng điểm trên bản đồ để tạo đường đo. Khoảng cách tính theo đường Geodesic (chuẩn trắc địa). Panel bên phải hiển thị tổng khoảng cách và từng đoạn.',
        tags: ['đo', 'khoảng cách', 'measure'],
      },
      {
        q: 'Công cụ Vẽ & Đo đạc có thể làm gì?',
        a: 'Bấm "Vẽ & đo đạc" → chọn Điểm / Đường / Vùng:\n• Điểm: click để đặt điểm, hiển thị tọa độ.\n• Đường: click nhiều điểm, double-click để hoàn thành, hiển thị tổng chiều dài.\n• Vùng: click nhiều điểm, double-click để đóng vùng, hiển thị diện tích (m², ha, km²).\nBấm "GeoJSON" để xuất toàn bộ về máy.',
        tags: ['vẽ', 'đo', 'polygon', 'diện tích'],
      },
      {
        q: 'Bookmark địa điểm dùng như thế nào?',
        a: 'Di chuyển bản đồ đến vị trí muốn lưu → bấm "Địa điểm đã lưu" → nhập tên → bấm "+". Bookmark lưu vào trình duyệt (localStorage), click vào tên để quay lại vị trí đó nhanh.',
        tags: ['bookmark', 'lưu', 'địa điểm'],
      },
      {
        q: 'Nhập file GIS (Shapefile, GeoJSON, KML) lên bản đồ như thế nào?',
        a: 'Bấm "Nhập GIS" → kéo thả hoặc chọn file. Hỗ trợ định dạng: GeoJSON (.geojson/.json), KML (.kml), Shapefile (.zip). Dung lượng tối đa 20 MB. Layer nhập vào hiển thị tạm trên bản đồ, không lưu vĩnh viễn.',
        tags: ['gis', 'shapefile', 'geojson', 'kml', 'import'],
      },
      {
        q: 'Gom cụm điểm cháy (clustering) là gì?',
        a: 'Khi zoom ra xa, các điểm cháy gần nhau được gom thành 1 vòng tròn có số đếm. Màu vòng tròn thể hiện mức độ nguy cơ cao nhất trong cụm (xanh=thấp, vàng=TB, cam=cao, đỏ=cực cao). Click vào cụm để zoom vào xem từng điểm. Tắt/bật gom cụm trong panel "Lớp bản đồ" → dòng "Vị trí điểm cháy" → nút "Gom cụm điểm cháy".',
        tags: ['cluster', 'gom cụm', 'điểm cháy'],
      },
    ],
  },
  {
    id: 'incident',
    label: 'Sự cố & Cảnh báo',
    icon: 'local_fire_department',
    items: [
      {
        q: 'Điểm cháy (Hotspot) và Sự cố (Incident) khác nhau như thế nào?',
        a: '• Điểm cháy: phát hiện tự động từ cảm biến/vệ tinh, chưa xác minh.\n• Sự cố: đã được kiểm lâm xác minh và tạo hồ sơ xử lý, có trạng thái (Chưa kiểm soát / Đang kiểm soát / Đã kiểm soát).',
        tags: ['hotspot', 'sự cố', 'incident', 'điểm cháy'],
      },
      {
        q: 'Làm thế nào để giao nhiệm vụ xác minh cho kiểm lâm?',
        a: 'Vào Sự cố → chọn sự cố cần giao → bấm "Giao nhiệm vụ" → chọn kiểm lâm và đặt deadline → Lưu. Kiểm lâm sẽ nhận thông báo qua WebSocket.',
        tags: ['giao nhiệm vụ', 'kiểm lâm', 'assign'],
      },
      {
        q: 'Cập nhật trạng thái sự cố như thế nào?',
        a: 'Vào Sự cố → click vào dòng sự cố → dropdown "Trạng thái" → chọn trạng thái mới → Lưu. Thay đổi được log vào Nhật ký kiểm toán.',
        tags: ['trạng thái', 'cập nhật', 'status'],
      },
      {
        q: 'Thông báo realtime hoạt động như thế nào?',
        a: 'Icon chuông ở góc trên phải tự động polling mỗi 30 giây. Khi có điểm cháy mới hoặc sự cố chưa kiểm soát, badge đỏ hiện số lượng. Bấm chuông để xem danh sách cảnh báo mới nhất.',
        tags: ['thông báo', 'realtime', 'cảnh báo'],
      },
      {
        q: 'Tìm kiếm nâng cao đa thuộc tính dùng như thế nào?',
        a: 'Vào Tìm kiếm → nhập từ khóa hoặc lọc theo: loại đối tượng, khoảng thời gian, mức độ ưu tiên, trạng thái, vùng địa lý. Kết quả hiển thị cả hotspot lẫn sự cố.',
        tags: ['tìm kiếm', 'search', 'filter', 'lọc'],
      },
    ],
  },
  {
    id: 'account',
    label: 'Tài khoản',
    icon: 'manage_accounts',
    items: [
      {
        q: 'Đổi mật khẩu như thế nào?',
        a: 'Vào Hồ sơ cá nhân (click tên ở sidebar) → tab "Bảo mật" → nhập mật khẩu cũ và mật khẩu mới → Lưu.',
        tags: ['mật khẩu', 'password', 'đổi'],
      },
      {
        q: 'Các vai trò (role) trong hệ thống là gì?',
        a: '• Admin: toàn quyền — quản lý người dùng, địa bàn, nhật ký kiểm toán.\n• Manager: quản lý sự cố, giao nhiệm vụ, xem báo cáo.\n• Ranger (Kiểm lâm): nhận nhiệm vụ, cập nhật trạng thái, xem bản đồ.',
        tags: ['vai trò', 'role', 'admin', 'ranger', 'phân quyền'],
      },
      {
        q: 'Admin thêm người dùng mới như thế nào?',
        a: 'Vào Quản trị → Người dùng → bấm "Thêm người dùng" → điền thông tin và chọn vai trò → Lưu. Tài khoản mới có thể đăng nhập ngay.',
        tags: ['thêm người dùng', 'admin', 'user'],
      },
      {
        q: 'Gán địa bàn phụ trách cho kiểm lâm như thế nào?',
        a: 'Vào Quản trị → Địa bàn → chọn kiểm lâm từ danh sách → tích chọn huyện/xã/tiểu khu cần gán → Lưu. Kiểm lâm chỉ thấy dữ liệu trong địa bàn được gán.',
        tags: ['địa bàn', 'aor', 'gán', 'kiểm lâm'],
      },
    ],
  },
  {
    id: 'report',
    label: 'Báo cáo & Xuất dữ liệu',
    icon: 'assessment',
    items: [
      {
        q: 'Xuất dữ liệu sang CSV/Excel như thế nào?',
        a: 'Trên các trang danh sách (Sự cố, Điểm cháy, Người dùng...) → bấm nút "Xuất" hoặc biểu tượng tải xuống → chọn định dạng CSV hoặc XLSX. Dữ liệu xuất theo bộ lọc hiện tại.',
        tags: ['xuất', 'export', 'csv', 'excel'],
      },
      {
        q: 'Xem thống kê và biểu đồ ở đâu?',
        a: 'Vào Thống kê → có biểu đồ cột (số sự cố theo tháng), biểu đồ tròn (phân bổ theo trạng thái), biểu đồ đường (xu hướng). Chọn khoảng thời gian ở góc trên để lọc.',
        tags: ['thống kê', 'biểu đồ', 'analytics'],
      },
      {
        q: 'Dashboard hiệu suất cá nhân xem ở đâu?',
        a: 'Vào Hiệu suất → xem KPI của bản thân: số nhiệm vụ hoàn thành, tỉ lệ đúng hạn, thời gian xử lý trung bình. Admin thấy thêm bảng xếp hạng toàn đội.',
        tags: ['hiệu suất', 'kpi', 'performance'],
      },
      {
        q: 'Nhật ký kiểm toán (Audit Log) là gì?',
        a: 'Ghi lại toàn bộ thao tác quan trọng: đăng nhập, tạo/sửa/xóa sự cố, giao nhiệm vụ, thay đổi quyền. Không thể sửa hay xóa log. Admin xem tại Quản trị → Nhật ký.',
        tags: ['audit log', 'nhật ký', 'lịch sử'],
      },
    ],
  },
  {
    id: 'general',
    label: 'Chung',
    icon: 'help',
    items: [
      {
        q: 'Trình duyệt nào được hỗ trợ?',
        a: 'Hệ thống hoạt động tốt nhất trên Chrome 90+, Edge 90+, Firefox 88+. Safari 14+ được hỗ trợ nhưng một số tính năng bản đồ có thể chậm hơn. Không hỗ trợ Internet Explorer.',
        tags: ['trình duyệt', 'browser', 'chrome'],
      },
      {
        q: 'Dữ liệu có được cập nhật realtime không?',
        a: 'Điểm cháy và sự cố được cập nhật qua WebSocket — thay đổi hiển thị ngay không cần tải lại trang. Bản đồ nhiệt nguy cơ cháy cập nhật theo chu kỳ từ backend.',
        tags: ['realtime', 'cập nhật', 'websocket'],
      },
      {
        q: 'Hệ thống bị chậm hoặc không tải được bản đồ phải làm sao?',
        a: '1. Kiểm tra kết nối internet.\n2. Xóa cache trình duyệt (Ctrl+Shift+Delete).\n3. Tải lại trang (F5).\n4. Nếu vẫn lỗi, liên hệ admin hệ thống.',
        tags: ['lỗi', 'chậm', 'bản đồ', 'troubleshoot'],
      },
      {
        q: 'Bảng tin (Bulletins) dùng để làm gì?',
        a: 'Đăng thông báo chung cho toàn hệ thống: cảnh báo mùa khô, lịch trực, hướng dẫn mới. Manager/Admin có thể tạo, sửa, xóa, ghim (pin) thông báo quan trọng lên đầu.',
        tags: ['bảng tin', 'bulletin', 'thông báo'],
      },
    ],
  },
]

const CATEGORIES_EN: Category[] = [
  {
    id: 'map',
    label: 'Map',
    icon: 'map',
    items: [
      {
        q: 'How do I change the base map?',
        a: 'Go to the Map page → "Map Layers" panel on the left → select "Dark", "Light", or "Geographic" in the Base Map section.',
        tags: ['map', 'basemap', 'background'],
      },
      {
        q: 'How do I use the Go to Coordinate tool?',
        a: 'Click "Go to Coordinate" on the toolbar → enter latitude (Lat), longitude (Lng), and zoom level → click "Fly to location". Reference coordinates for the center of Thanh Hoa: 19.8°N, 105.78°E.',
        tags: ['coordinate', 'goto', 'navigate'],
      },
      {
        q: 'How do I measure distance on the map?',
        a: 'Click "Measure Distance" → click points on the map to create a measurement path. Distance is calculated along geodesic lines (geodetic standard). The right panel shows total distance and individual segments.',
        tags: ['measure', 'distance'],
      },
      {
        q: 'What can the Draw & Measure tool do?',
        a: 'Click "Draw & Measure" → choose Point / Line / Area:\n• Point: click to place a point, shows coordinates.\n• Line: click multiple points, double-click to finish, shows total length.\n• Area: click multiple points, double-click to close the area, shows area (m², ha, km²).\nClick "GeoJSON" to export all drawings to your device.',
        tags: ['draw', 'measure', 'polygon', 'area'],
      },
      {
        q: 'How do I use bookmarks?',
        a: 'Navigate the map to the desired location → click "Saved Places" → enter a name → click "+". Bookmarks are saved in the browser (localStorage). Click a bookmark name to return to that location quickly.',
        tags: ['bookmark', 'save', 'place'],
      },
      {
        q: 'How do I import GIS files (Shapefile, GeoJSON, KML) to the map?',
        a: 'Click "Import GIS" → drag and drop or select a file. Supported formats: GeoJSON (.geojson/.json), KML (.kml), Shapefile (.zip). Maximum size: 20 MB. Imported layers are displayed temporarily on the map and not saved permanently.',
        tags: ['gis', 'shapefile', 'geojson', 'kml', 'import'],
      },
      {
        q: 'What is hotspot clustering?',
        a: 'When zoomed out, nearby hotspots are grouped into a circle showing a count. The circle color reflects the highest risk level in the group (blue=low, yellow=medium, orange=high, red=extreme). Click a cluster to zoom in and see individual points. Toggle clustering in the "Map Layers" panel → "Hotspot Locations" row → "Cluster hotspots" button.',
        tags: ['cluster', 'hotspot', 'group'],
      },
    ],
  },
  {
    id: 'incident',
    label: 'Incidents & Alerts',
    icon: 'local_fire_department',
    items: [
      {
        q: 'What is the difference between a Hotspot and an Incident?',
        a: '• Hotspot: automatically detected by sensors/satellites, not yet verified.\n• Incident: verified by forest rangers with a case file created, has a status (Uncontrolled / Containing / Controlled).',
        tags: ['hotspot', 'incident', 'difference'],
      },
      {
        q: 'How do I assign a verification task to a ranger?',
        a: 'Go to Incidents → select the incident → click "Assign Task" → choose a ranger and set a deadline → Save. The ranger will receive a notification via WebSocket.',
        tags: ['assign', 'task', 'ranger'],
      },
      {
        q: 'How do I update an incident status?',
        a: 'Go to Incidents → click the incident row → "Status" dropdown → select the new status → Save. Changes are logged in the Audit Log.',
        tags: ['status', 'update', 'incident'],
      },
      {
        q: 'How does real-time notification work?',
        a: 'The bell icon in the top right polls automatically every 30 seconds. When a new hotspot or uncontrolled incident occurs, a red badge shows the count. Click the bell to view the latest alerts.',
        tags: ['notification', 'realtime', 'alert'],
      },
      {
        q: 'How do I use advanced multi-attribute search?',
        a: 'Go to Search → enter keywords or filter by: object type, time range, priority level, status, geographic area. Results include both hotspots and incidents.',
        tags: ['search', 'filter', 'advanced'],
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    icon: 'manage_accounts',
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Profile (click your name in the sidebar) → "Security" tab → enter old and new passwords → Save.',
        tags: ['password', 'change', 'security'],
      },
      {
        q: 'What are the system roles?',
        a: '• Admin: full access — manage users, areas of responsibility, audit logs.\n• Manager: manage incidents, assign tasks, view reports.\n• Ranger: receive tasks, update status, view the map.',
        tags: ['role', 'admin', 'ranger', 'permission'],
      },
      {
        q: 'How does an Admin add a new user?',
        a: 'Go to Admin → Users → click "Add User" → fill in details and select a role → Save. The new account can log in immediately.',
        tags: ['add user', 'admin', 'user'],
      },
      {
        q: 'How do I assign an area of responsibility to a ranger?',
        a: 'Go to Admin → Areas → select a ranger from the list → check the districts/communes/subcompartments to assign → Save. Rangers only see data within their assigned area.',
        tags: ['area', 'aor', 'assign', 'ranger'],
      },
    ],
  },
  {
    id: 'report',
    label: 'Reports & Export',
    icon: 'assessment',
    items: [
      {
        q: 'How do I export data to CSV/Excel?',
        a: 'On list pages (Incidents, Hotspots, Users...) → click the "Export" button or download icon → choose CSV or XLSX format. Data is exported based on the current filters.',
        tags: ['export', 'csv', 'excel', 'download'],
      },
      {
        q: 'Where can I view statistics and charts?',
        a: 'Go to Analytics → see bar charts (incidents per month), pie charts (distribution by status), and line charts (trends). Select a time range at the top to filter.',
        tags: ['analytics', 'chart', 'statistics'],
      },
      {
        q: 'Where can I view my personal performance dashboard?',
        a: 'Go to Performance → view your own KPIs: tasks completed, on-time rate, average processing time. Admins also see a full team leaderboard.',
        tags: ['performance', 'kpi', 'dashboard'],
      },
      {
        q: 'What is the Audit Log?',
        a: 'Records all important actions: logins, creating/editing/deleting incidents, assigning tasks, changing permissions. Logs cannot be edited or deleted. Admins can view it at Admin → Audit Log.',
        tags: ['audit log', 'history', 'log'],
      },
    ],
  },
  {
    id: 'general',
    label: 'General',
    icon: 'help',
    items: [
      {
        q: 'Which browsers are supported?',
        a: 'The system works best on Chrome 90+, Edge 90+, Firefox 88+. Safari 14+ is supported but some map features may be slower. Internet Explorer is not supported.',
        tags: ['browser', 'chrome', 'support'],
      },
      {
        q: 'Is the data updated in real time?',
        a: 'Hotspots and incidents are updated via WebSocket — changes appear instantly without needing to reload the page. The fire risk heatmap is updated periodically from the backend.',
        tags: ['realtime', 'update', 'websocket'],
      },
      {
        q: 'What should I do if the system is slow or the map won\'t load?',
        a: '1. Check your internet connection.\n2. Clear the browser cache (Ctrl+Shift+Delete).\n3. Reload the page (F5).\n4. If the problem persists, contact your system administrator.',
        tags: ['slow', 'map', 'error', 'troubleshoot'],
      },
      {
        q: 'What are Bulletins used for?',
        a: 'Post general announcements for the whole system: dry season warnings, duty schedules, new guidelines. Manager/Admin can create, edit, delete, and pin important announcements to the top.',
        tags: ['bulletin', 'announcement', 'news'],
      },
    ],
  },
]

const QUICK_LINK_DEFS = [
  { navKey: 'map',       to: '/map',         icon: 'map' },
  { navKey: 'incidents', to: '/incidents',   icon: 'local_fire_department' },
  { navKey: 'search',    to: '/search',      icon: 'manage_search' },
  { navKey: 'analytics', to: '/analytics',   icon: 'bar_chart' },
  { navKey: 'profile',   to: '/profile',     icon: 'account_circle' },
]

export default function FAQ() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [activeCategory, setActiveCategory] = useState('map')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const categories = i18n.language === 'en' ? CATEGORIES_EN : CATEGORIES_VI

  const quickLinks = QUICK_LINK_DEFS.map(({ navKey, to, icon }) => ({
    label: t(`nav.${navKey}`),
    to,
    icon,
  }))

  const currentCategory = categories.find(c => c.id === activeCategory) ?? categories[0]

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return currentCategory.items
    return categories.flatMap(c => c.items).filter(
      item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q) || item.tags.some(tag => tag.includes(q))
    )
  }, [query, currentCategory, categories])

  const isSearching = query.trim().length > 0

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2e4a] to-[#1565c0] px-6 py-10 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-4">
            <span className="material-symbols-outlined text-3xl">help_center</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('faq.title')}</h1>
          <p className="text-white/70 text-sm mb-6">{t('faq.subtitle')}</p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-xl">search</span>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setOpenItem(null) }}
              placeholder={t('faq.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-[#1e293b] bg-white shadow focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#1e293b]">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick links */}
        {!isSearching && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">{t('faq.quickLinks')}</p>
            <div className="flex gap-2 flex-wrap">
              {quickLinks.map(({ label, to, icon }) => (
                <button key={to} onClick={() => navigate(to)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e2e8f0] rounded-lg text-xs text-[#64748b] hover:border-[#1565c0] hover:text-[#1565c0] transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Category sidebar */}
          {!isSearching && (
            <div className="w-44 flex-shrink-0">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">{t('faq.categories')}</p>
              <div className="space-y-1">
                {categories.map(c => (
                  <button key={c.id} onClick={() => { setActiveCategory(c.id); setOpenItem(null) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                      activeCategory === c.id
                        ? 'bg-[#1565c0] text-white'
                        : 'text-[#64748b] hover:bg-white hover:text-[#1e293b]'
                    }`}>
                    <span className="material-symbols-outlined text-base flex-shrink-0">{c.icon}</span>
                    <span className="font-medium">{c.label}</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeCategory === c.id ? 'bg-white/20 text-white' : 'bg-[#f1f5f9] text-[#94a3b8]'
                    }`}>{c.items.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FAQ list */}
          <div className="flex-1 min-w-0">
            {isSearching && (
              <p className="text-sm text-[#64748b] mb-4">
                {filteredItems.length > 0
                  ? t('faq.searchResult', { count: String(filteredItems.length), query })
                  : t('faq.noMatchSearch', { query })}
              </p>
            )}

            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-[#94a3b8]">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                <p className="text-sm font-medium">{t('faq.noResult')}</p>
                <p className="text-xs mt-1">{t('faq.noResultHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item, i) => {
                  const key = `${activeCategory}-${i}`
                  const isOpen = openItem === key
                  return (
                    <div key={key}
                      className={`bg-white rounded-xl border transition-all ${isOpen ? 'border-[#1565c0] shadow-sm' : 'border-[#e2e8f0]'}`}>
                      <button
                        onClick={() => setOpenItem(isOpen ? null : key)}
                        className="w-full flex items-center gap-3 px-4 py-4 text-left"
                      >
                        <span className={`material-symbols-outlined text-lg flex-shrink-0 transition-colors ${isOpen ? 'text-[#1565c0]' : 'text-[#94a3b8]'}`}>
                          {isOpen ? 'remove_circle' : 'add_circle'}
                        </span>
                        <span className={`text-sm font-medium flex-1 ${isOpen ? 'text-[#1565c0]' : 'text-[#1e293b]'}`}>
                          {item.q}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pl-11">
                          <div className="text-sm text-[#475569] leading-relaxed whitespace-pre-line">
                            {item.a}
                          </div>
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {item.tags.map(tag => (
                              <span key={tag}
                                className="px-2 py-0.5 bg-[#f1f5f9] text-[#64748b] text-[10px] rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Contact footer */}
            {!isSearching && (
              <div className="mt-8 p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-[#1565c0] text-xl flex-shrink-0 mt-0.5">support_agent</span>
                <div>
                  <p className="text-sm font-semibold text-[#1e293b]">{t('faq.contact')}</p>
                  <p className="text-xs text-[#64748b] mt-0.5">{t('faq.contactDesc')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
