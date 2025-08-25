# Subscription Tracker App - Technical Specification

## Overview
A Mac menu bar application that tracks subscription services and alerts users before renewal dates to provide time for cancellation decisions.

## Technology Stack
- **Framework**: Electron
- **Frontend**: React
- **Database**: SQLite (local storage)
- **Menu Bar**: Electron Tray API
- **AI Integration**: OpenAI API for natural language parsing
- **Packaging**: electron-builder for Mac App Store distribution

## Core Features

### 1. Menu Bar Integration
- **Icon Display**: Small symbol in Mac menu bar
- **Color States**:
  - Gray/Black: Default state (no imminent renewals)
  - Yellow: Service renewing within 30 days (annual) or 3 days (monthly)
  - Red: Service renewing within 2 days
- **Click Behavior**: Opens main application window
- **Quick Add**: Text input field accessible from menu bar for adding new services

### 2. Main Application Window

#### Two-Tab Interface:
1. **Active Services Tab**
   - List of currently active/paid subscriptions
   - Sorted by renewal date (soonest first)
   - Display: Service name, cost, currency, next renewal date, frequency
   - Daily total spend display (separate USD and EUR totals)

2. **Inactive Services Tab**
   - List of previously subscribed services
   - Ability to reactivate services (move back to active)
   - Edit functionality for stored service details

#### Service Management:
- **Add Service**: Natural language text input
- **Edit Service**: Modify existing service details
- **Delete Service**: Remove service from lists
- **Reactivate**: Move inactive service back to active status

### 3. Natural Language Processing
- **Input Format**: Free text like "Subscribe to Netflix on June 15th, paying $15 monthly"
- **OpenAI Integration**: Parse text into structured data
- **Error Handling**: Display "Sorry, couldn't parse, please try again" for unparseable input
- **No Relative Dates**: Only accept absolute dates

### 4. Data Structure

```json
{
  "id": "uuid",
  "name": "Netflix",
  "cost": 15.00,
  "currency": "USD" | "EUR",
  "renewalDate": "2025-06-15",
  "frequency": "monthly" | "annual",
  "status": "active" | "inactive",
  "tags": ["#entertainment", "#streaming"],
  "addedDate": "2025-01-15",
  "lastModified": "2025-01-15"
}
```

### 5. Notification System
- **Desktop Notifications** at:
  - 30 days before (annual subscriptions)
  - 7 days before (all subscriptions)
  - 3 days before (all subscriptions)
  - 1 day before (all subscriptions)
- **Snooze Functionality**: Temporarily dismiss notifications
- **No Action Buttons**: Simple notification display only

### 6. Search and Filtering
- **Search**: Text-based search across service names
- **Filter by Tags**: If hashtags are detected in service descriptions
- **Filter by Currency**: Toggle USD/EUR services
- **Filter by Status**: Active/Inactive toggle

## Technical Requirements

### Database Schema
```sql
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost REAL NOT NULL,
  currency TEXT NOT NULL,
  renewal_date DATE NOT NULL,
  frequency TEXT NOT NULL,
  status TEXT NOT NULL,
  tags TEXT,
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### System Integration
- **Auto-launch**: Configure as login item for macOS
- **Background Process**: Continuous monitoring of renewal dates
- **Menu Bar Persistence**: Always visible in menu bar
- **Window Management**: Hide to menu bar when closed

### OpenAI Integration
- **Model**: GPT-4 or GPT-3.5-turbo
- **Prompt Engineering**: Parse subscription details from natural language
- **Response Format**: Structured JSON output
- **Error Handling**: Graceful fallback for parsing failures

## User Interface Design

### Menu Bar
- **Default State**: Simple subscription icon (gray/black)
- **Alert States**: Same icon in yellow or red
- **Dropdown Menu**:
  - Quick add service (text input)
  - Open main window
  - Quit application

### Main Window
- **Size**: 600x800px (resizable)
- **Layout**: Tab-based interface
- **Service List Items**:
  - Service name and tags
  - Cost and currency
  - Next renewal date
  - Days until renewal
  - Edit/Delete buttons

### Totals Display
- **Current Month Spend**: 
  - USD Total: $XXX.XX
  - EUR Total: €XXX.XX
- **Calculated from**: All active services' monthly cost equivalent

## Business Logic

### Renewal Date Calculation
- **Monthly**: Add 1 month to last renewal date
- **Annual**: Add 1 year to last renewal date
- **Icon Color Logic**:
  - Red: Any service renewing ≤ 2 days
  - Yellow: Any service renewing ≤ 3 days (monthly) or ≤ 30 days (annual)
  - Gray: No imminent renewals

### Data Management
- **Local Storage Only**: No cloud synchronization
- **Backup**: Manual export/import capability
- **Data Persistence**: SQLite database in user's app data folder

## Development Phases

### Phase 1: Core Structure
- Electron app setup with React
- Menu bar integration with Tray API
- Basic SQLite database setup
- Simple service list display

### Phase 2: Service Management
- Add/edit/delete services
- Tab-based interface
- Search and filtering
- Basic date calculations

### Phase 3: AI Integration
- OpenAI API integration
- Natural language parsing
- Structured data extraction
- Error handling

### Phase 4: Notifications & Polish
- Desktop notification system
- Icon color changes
- Auto-launch configuration
- UI polish and testing

### Phase 5: Distribution
- Mac App Store packaging
- Code signing and notarization
- Testing and quality assurance

## Technical Constraints
- **No Relative Dates**: Only absolute date parsing
- **No Currency Conversion**: Maintain separate USD/EUR totals
- **No External Sync**: Purely local application
- **Simple Error Handling**: Basic retry mechanism for failed parsing

## Success Metrics
- Accurate renewal date tracking
- Reliable notification delivery
- Smooth natural language parsing (>80% success rate)
- Minimal system resource usage
- Stable menu bar presence