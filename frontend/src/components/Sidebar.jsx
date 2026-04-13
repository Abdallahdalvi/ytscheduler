import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Upload,
  BarChart2, Settings, PlayCircle, LogOut, ChevronRight, ClipboardList, ScrollText, FolderOpen, Bell, Menu, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { notificationsService } from '../modules/notifications/notifications.service'
import { getChannels, getAuthUrl, switchChannel, disconnect } from '../api'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schedule', icon: Upload, label: 'Upload Queue' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/videos', icon: PlayCircle, label: 'Videos' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/templates', icon: ClipboardList, label: 'Templates' },
  { to: '/media', icon: FolderOpen, label: 'Media Library' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/activity', icon: ScrollText, label: 'Activity Logs' },
]

function getPageInfo(pathname, user) {
  switch (pathname) {
    case '/':
      return {
        title: 'Dashboard',
        subtitle: user?.email ? `YTScheduler for ${user.email}` : 'Channel overview',
      }
    case '/schedule':
      return { title: 'Upload Queue', subtitle: 'Schedule and manage your YouTube videos' }
    case '/analytics':
      return { title: 'Analytics', subtitle: 'Performance tracking' }
    case '/videos':
      return { title: 'Videos', subtitle: 'Manage content and bulk actions' }
    case '/calendar':
      return { title: 'Calendar', subtitle: 'Plan your posting schedule' }
    case '/templates':
      return { title: 'Templates', subtitle: 'Reuse saved content templates' }
    case '/media':
      return { title: 'Media Library', subtitle: 'Manage your media files' }
    case '/notifications':
      return { title: 'Notifications', subtitle: 'Recent alerts and updates' }
    case '/activity':
      return { title: 'Activity Logs', subtitle: 'Recent app activity' }
    case '/settings':
      return { title: 'Settings', subtitle: 'App and channel settings' }
    default:
      return { title: 'YTScheduler', subtitle: 'Executive Suite' }
  }
}

export default function Sidebar({ authStatus }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [channels, setChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [showChannelList, setShowChannelList] = useState(false)
  const pageInfo = getPageInfo(location.pathname, user)

  useEffect(() => {
    if (authStatus?.connected) {
      loadChannels()
    }
  }, [authStatus?.connected])

  async function loadChannels() {
    try {
      setChannelsLoading(true)
      const res = await getChannels()
      setChannels(res.data.channels || [])
    } catch {
      setChannels([])
    } finally {
      setChannelsLoading(false)
    }
  }

  async function handleSwitchChannel(cid) {
    if (cid === authStatus?.channel_id) return
    try {
      toast.loading('Switching channel...')
      await switchChannel(cid)
      window.location.reload() // Reload to refresh all data for new channel context
    } catch (err) {
      toast.dismiss()
      toast.error('Failed to switch channel')
    }
  }

  async function handleConnectAnother() {
    try {
      const res = await getAuthUrl()
      const authUrl = res?.data?.data?.url || res?.data?.url
      if (!authUrl) throw new Error('Auth URL not returned by server')
      window.open(authUrl, '_blank', 'width=600,height=700')
    } catch (e) {
      toast.error('Failed to get auth URL')
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect this YouTube channel? Scheduled videos will not be published.')) return
    try {
      await disconnect()
      toast.success('Channel disconnected')
      window.location.reload()
    } catch (err) {
      toast.error('Failed to disconnect channel')
    }
  }

  useEffect(() => {
    notificationsService.getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {})
  }, [])

  async function handleLogout() {
    if (!confirm('Log out from YTScheduler?')) return
    await signOut()
    toast.success('Logged out successfully')
  }

  return (
    <>
      {/* Mobile Sidebar Toggle */}
      <button 
        className="btn btn-ghost mobile-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <PlayCircle size={18} />
          </div>
          <div>
            <div className="logo-text">YTScheduler</div>
            <div className="logo-sub">Executive Suite</div>
          </div>
        </div>

        <div className="sidebar-context">
          <div>
            <div className="sidebar-context-title">{pageInfo.title}</div>
            <div className="sidebar-context-subtitle">{pageInfo.subtitle}</div>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            title="Settings"
            onClick={() => {
              navigate('/settings')
              setSidebarOpen(false)
            }}
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Navigation */}
        <div className="sidebar-section">
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {to === '/notifications' && unreadCount > 0 && (
                  <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Account & Channel Management */}
        <div className="sidebar-channel">
          {authStatus?.connected ? (
            <div style={{ position: 'relative' }}>
              <div 
                className="channel-card active" 
                onClick={() => setShowChannelList(!showChannelList)} 
                style={{ 
                  marginBottom: '8px', 
                  border: showChannelList ? '1px solid var(--primary)' : '1px solid var(--primary-shadow)', 
                  background: 'var(--primary-xlight)',
                  cursor: 'pointer'
                }}
              >
                <div className="channel-avatar">
                  {authStatus.channel_thumbnail ? (
                    <img src={authStatus.channel_thumbnail} alt="Channel" />
                  ) : (
                    <PlayCircle size={20} className="channel-avatar-placeholder" />
                  )}
                </div>
                <div className="channel-info">
                  <div className="channel-name" title={authStatus.channel_title}>{authStatus.channel_title}</div>
                  <div className="channel-status" style={{ color: 'var(--primary)' }}>● Active Channel</div>
                </div>
                <div style={{ transform: showChannelList ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <ChevronRight size={14} style={{ opacity: 0.4 }} />
                </div>
              </div>

              {showChannelList && (
                <div className="glass-panel" style={{ 
                  position: 'absolute', 
                  bottom: '100%', 
                  left: 0, 
                  width: '100%', 
                  marginBottom: '8px',
                  padding: '8px',
                  zIndex: 100,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '8px', fontWeight: 700, padding: '0 8px' }}>SWITCH CHANNEL</div>
                  
                  {channels.map(c => (
                    <div 
                      key={c.channel_id} 
                      className={`channel-item ${c.channel_id === authStatus.channel_id ? 'active' : ''}`}
                      onClick={() => handleSwitchChannel(c.channel_id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px 8px', 
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: c.channel_id === authStatus.channel_id ? 'rgba(255,255,255,0.05)' : 'transparent',
                        marginBottom: '2px'
                      }}
                    >
                      <img src={c.channel_thumbnail} style={{ width: '20px', height: '20px', borderRadius: '50%' }} alt="" />
                      <div className="channel-name" style={{ fontSize: '11px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.channel_title}</div>
                      {c.channel_id === authStatus.channel_id && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />}
                    </div>
                  ))}

                  <div className="dropdown-divider" style={{ margin: '8px 0' }}></div>
                  <button 
                    className="btn btn-ghost btn-xs" 
                    style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--primary)' }}
                    onClick={handleConnectAnother}
                  >
                    <Upload size={14} /> Link New Channel
                  </button>
                  <button 
                    className="btn btn-ghost btn-xs" 
                    style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)', marginTop: '4px' }}
                    onClick={handleDisconnect}
                  >
                    <X size={14} /> Disconnect Channel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="channel-card" onClick={handleConnectAnother} style={{ marginBottom: '8px', opacity: 0.7, cursor: 'pointer' }}>
              <div className="channel-avatar">
                <PlayCircle size={20} className="channel-avatar-placeholder" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="channel-info">
                <div className="channel-name">No Channel</div>
                <div className="channel-status" style={{ color: 'var(--text-tertiary)' }}>○ Click to Connect</div>
              </div>
            </div>
          )}

          {/* Supabase User */}
          <div className="channel-card" onClick={() => navigate('/settings')} style={{ background: 'transparent' }}>
            <div className="channel-avatar" style={{ background: 'var(--surface-tertiary)' }}>
              <span className="channel-avatar-placeholder" style={{ fontSize: '10px' }}>{user?.email?.[0].toUpperCase() || 'U'}</span>
            </div>
            <div className="channel-info">
              <div className="channel-name" style={{ fontSize: '11px' }}>{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</div>
              <div className="channel-status" style={{ fontSize: '9px', color: 'var(--success)' }}>● Logged In</div>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: '8px', width: '100%', justifyContent: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}
            onClick={handleLogout}
          >
            <LogOut size={12} /> Log Out
          </button>
        </div>
      </aside>
    </>
  )
}
