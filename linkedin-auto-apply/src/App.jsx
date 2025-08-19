import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { 
  Play, 
  Pause, 
  Settings, 
  Target, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Briefcase,
  MapPin,
  DollarSign,
  Users,
  TrendingUp,
  Zap,
  Shield,
  Bot,
  Activity,
  Download,
  Upload,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import './App.css'

// API base URL - use relative paths for deployment
const API_BASE = import.meta.env.VITE_API_BASE || '/api/automation'

function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    success_rate: 0
  })
  const [settings, setSettings] = useState({
    keywords: 'software engineer, backend developer, full stack developer',
    location: 'United States',
    experience_level: '1-3 years',
    salary_min: '80000',
    job_type: 'Full-time',
    remote: true,
    hybrid: true,
    onsite: true,
    auto_answer: true,
    years_experience: '3',
    cover_letter: 'Dear Hiring Manager,\n\nI am excited to apply for this position. With my background in software engineering and passion for technology, I believe I would be a valuable addition to your team.\n\nBest regards'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [automationStatus, setAutomationStatus] = useState(null)

  // Fetch initial data
  useEffect(() => {
    fetchStats()
    fetchApplications()
    fetchSettings()
    fetchAutomationStatus()
  }, [])

  // Poll for updates when automation is running
  useEffect(() => {
    let interval
    if (isRunning) {
      interval = setInterval(() => {
        fetchStats()
        fetchApplications()
        fetchAutomationStatus()
              }, 3000) // Every 3 seconds
    }
    return () => clearInterval(interval)
  }, [isRunning])

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const fetchApplications = async () => {
    try {
      const response = await fetch(`${API_BASE}/applications?per_page=50`)
      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications)
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`)
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    }
  }

  const fetchAutomationStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/status`)
      if (response.ok) {
        const data = await response.json()
        setAutomationStatus(data)
        setIsRunning(data.is_running)
      }
    } catch (err) {
      console.error('Failed to fetch automation status:', err)
    }
  }

  const simulateApplication = async () => {
    try {
      const response = await fetch(`${API_BASE}/simulate-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      if (response.ok) {
        // Data will be fetched in the next polling cycle
      }
    } catch (err) {
      console.error('Failed to simulate application:', err)
    }
  }

  const toggleAutomation = async () => {
    setLoading(true)
    setError('')
    
    try {
      const endpoint = isRunning ? 'stop' : 'start'
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setIsRunning(!isRunning)
        fetchAutomationStatus()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to toggle automation')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Failed to toggle automation:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        setError('')
        // Show success message briefly
        setError('Settings saved successfully!')
        setTimeout(() => setError(''), 3000)
      } else {
        setError('Failed to save settings')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Failed to save settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportData = async () => {
    try {
      const response = await fetch(`${API_BASE}/export`)
      if (response.ok) {
        const csvContent = await response.text()
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'linkedin_applications.csv'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      setError('Failed to export data')
      console.error('Failed to export data:', err)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0s'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LinkedIn Auto Apply</h1>
                <p className="text-sm text-gray-600">Intelligent Job Application Automation</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isRunning ? "default" : "secondary"} className="px-3 py-1">
                <Activity className="w-4 h-4 mr-1" />
                {isRunning ? 'Running' : 'Stopped'}
              </Badge>
              <Button
                onClick={toggleAutomation}
                disabled={loading}
                className={`px-6 ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : isRunning ? (
                  <Pause className="w-4 h-4 mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Processing...' : isRunning ? 'Stop' : 'Start'} Automation
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <Alert className={`mb-6 ${error.includes('successfully') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className={error.includes('successfully') ? 'text-green-800' : 'text-red-800'}>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Total Applications</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <Target className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100">Successful</p>
                  <p className="text-3xl font-bold">{stats.successful}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100">Failed</p>
                  <p className="text-3xl font-bold">{stats.failed}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100">Success Rate</p>
                  <p className="text-3xl font-bold">{stats.success_rate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Automation Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={isRunning ? "default" : "secondary"}>
                      {isRunning ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Applications/Hour</span>
                    <span className="font-semibold">{isRunning ? '600-1200' : '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Runtime</span>
                    <span className="text-sm text-gray-600">
                      {automationStatus?.duration_seconds ? formatDuration(automationStatus.duration_seconds) : 'Not running'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Next Application</span>
                    <span className="text-sm text-gray-600">{isRunning ? '3 seconds' : 'Stopped'}</span>
                  </div>
                  {isRunning && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>Running...</span>
                      </div>
                      <Progress value={75} className="w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="w-5 h-5 mr-2" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={exportData} 
                    variant="outline" 
                    className="w-full justify-start"
                    disabled={applications.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Applications CSV
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Resume
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Shield className="w-4 h-4 mr-2" />
                    Privacy Settings
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Applications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>Latest job applications submitted automatically</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {applications.slice(0, 5).map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${app.status === 'successful' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium">{app.title}</p>
                          <p className="text-sm text-gray-600">{app.company} • {app.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{app.salary}</p>
                        <p className="text-xs text-gray-500">{new Date(app.applied_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  {applications.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No applications yet. Start the automation to begin applying!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Job Search Criteria */}
              <Card>
                <CardHeader>
                  <CardTitle>Job Search Criteria</CardTitle>
                  <CardDescription>Configure your job search parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      value={settings.keywords}
                      onChange={(e) => setSettings({...settings, keywords: e.target.value})}
                      placeholder="software engineer, developer, programmer"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={settings.location}
                      onChange={(e) => setSettings({...settings, location: e.target.value})}
                      placeholder="United States, Remote, New York"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience Level</Label>
                    <Select value={settings.experience_level} onValueChange={(value) => setSettings({...settings, experience_level: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry Level (0-1 years)</SelectItem>
                        <SelectItem value="1-3 years">Mid Level (1-3 years)</SelectItem>
                        <SelectItem value="3-5 years">Senior Level (3-5 years)</SelectItem>
                        <SelectItem value="5+ years">Expert Level (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="salary">Minimum Salary ($)</Label>
                    <Input
                      id="salary"
                      type="number"
                      value={settings.salary_min}
                      onChange={(e) => setSettings({...settings, salary_min: e.target.value})}
                      placeholder="80000"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Work Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Work Preferences</CardTitle>
                  <CardDescription>Set your work arrangement preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="remote">Remote Work</Label>
                    <Switch
                      id="remote"
                      checked={settings.remote}
                      onCheckedChange={(checked) => setSettings({...settings, remote: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hybrid">Hybrid Work</Label>
                    <Switch
                      id="hybrid"
                      checked={settings.hybrid}
                      onCheckedChange={(checked) => setSettings({...settings, hybrid: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="onsite">On-site Work</Label>
                    <Switch
                      id="onsite"
                      checked={settings.onsite}
                      onCheckedChange={(checked) => setSettings({...settings, onsite: checked})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="autoAnswer">Auto-answer Questions</Label>
                    <Switch
                      id="autoAnswer"
                      checked={settings.auto_answer}
                      onCheckedChange={(checked) => setSettings({...settings, auto_answer: checked})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="yearsExp">Years of Experience (for auto-answers)</Label>
                    <Input
                      id="yearsExp"
                      type="number"
                      value={settings.years_experience}
                      onChange={(e) => setSettings({...settings, years_experience: e.target.value})}
                      placeholder="3"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cover Letter */}
            <Card>
              <CardHeader>
                <CardTitle>Cover Letter Template</CardTitle>
                <CardDescription>Customize your cover letter for applications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={settings.cover_letter}
                  onChange={(e) => setSettings({...settings, cover_letter: e.target.value})}
                  rows={6}
                  placeholder="Enter your cover letter template..."
                />
                <Button onClick={saveSettings} disabled={loading} className="w-full">
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Applications</CardTitle>
                  <CardDescription>Complete history of job applications</CardDescription>
                </div>
                <Button onClick={exportData} disabled={applications.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${app.status === 'successful' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium">{app.title}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center">
                              <Briefcase className="w-4 h-4 mr-1" />
                              {app.company}
                            </span>
                            <span className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {app.location}
                            </span>
                            <span className="flex items-center">
                              <DollarSign className="w-4 h-4 mr-1" />
                              {app.salary}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={app.status === 'successful' ? 'default' : 'destructive'}>
                          {app.status === 'successful' ? 'Applied' : 'Failed'}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">{new Date(app.applied_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {applications.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No applications yet</p>
                      <p>Start the automation to begin applying to jobs automatically!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p className="mb-2">LinkedIn Auto Apply - Intelligent Job Application Automation</p>
            <p className="text-sm">Built with React, Flask, and modern web technologies</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App

