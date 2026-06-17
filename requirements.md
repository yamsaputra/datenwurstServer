# Requirements: Library Occupancy Forecasting Platform

## 1. Project Overview

The goal is to build an application that receives people-counting data from an NVIDIA Jetson Orin Nano deployed in a library, stores and processes the data, enriches it with external/contextual signals, and predicts future library occupancy in half-hour intervals.

The system must provide:

- A protected webhook endpoint for receiving data from the Jetson device.
- A backend data pipeline for storing, validating, and processing occupancy data.
- A machine learning forecasting component that predicts future occupancy.
- Automatic monthly retraining of the ML model using newly collected data.
- A protected dashboard with login for library/admin users.
- Manual retraining controls and ML configuration options.
- Visualizations for current occupancy and predicted occupancy.
- A passwordless iframe/widget that the library can embed on its public website.

The frontend should preferably use a modern stack such as Next.js or Vite with shadcn/ui components. The ML technology is flexible and can be chosen by the implementation team.

---

## 2. Main Objectives

### 2.1 Data Ingestion

The application must receive people-counting data from the Jetson device through a secure webhook API.

The Jetson counts people entering and leaving the library. This data should be sent to the backend, where it is stored and used to calculate current occupancy and train forecasting models.

### 2.2 Occupancy Forecasting

The application must predict future occupancy in half-hour intervals.

Predictions should be available for:

- The next few hours.
- The next 7 days.

The forecasting model should use historical occupancy data and external/contextual features such as:

- Weather data.
- Semester period / semester break information.
- Day of week.
- Time of day.
- Public holidays.
- Library opening hours.
- Potentially special events or exam periods, if available.

### 2.3 Automatic Model Improvement

The ML model must not be static.

The system must automatically retrain the model once per month using the newly collected data. The goal is to improve prediction quality over time as more real library usage data becomes available.

Admins must also be able to trigger manual retraining from the dashboard.

### 2.4 Dashboard

The system must include a modern visual dashboard protected by login.

The dashboard should show:

- Current occupancy.
- Maximum configured occupancy.
- Current occupancy as a percentage of maximum occupancy.
- Predicted occupancy for the next hours.
- Predicted occupancy for the next week.
- Historical occupancy trends.
- Model status and last training date.
- Manual retraining controls.
- Basic ML/model configuration options.

### 2.5 Public Embeddable Widget

The system must provide a passwordless iframe or embeddable widget for the library website.

The widget should show:

- Current occupancy.
- Current occupancy compared to maximum occupancy.
- Expected occupancy for the next hours.
- Expected occupancy for the next days.

The widget must be read-only and safe to expose publicly.

---

## 3. Terminology

| Term | Meaning |
|---|---|
| Jetson | NVIDIA Jetson Orin Nano device counting people entering and leaving the library. |
| Entry Count | Number of people entering during a time interval. |
| Exit Count | Number of people leaving during a time interval. |
| Occupancy / Concurrency | Estimated number of people currently inside the library. |
| Max Occupancy | Configurable maximum allowed or expected capacity of the library. |
| Forecast | Predicted future occupancy value for a specific time interval. |
| Half-hour interval | A 30-minute time bucket, for example 10:00–10:30. |
| Admin Dashboard | Login-protected web interface for staff/admins. |
| Public Widget | Passwordless iframe/embed for the public library website. |
| Retraining | Training the ML model again using newer data. |

---

## 4. Scope

### 4.1 In Scope

The following features are in scope:

- Secure webhook endpoint for Jetson data ingestion.
- Storage of raw and processed occupancy data.
- Current occupancy calculation.
- Historical occupancy data aggregation.
- Weather data integration.
- Semester break / academic calendar integration.
- Public holiday integration.
- Forecasting in half-hour intervals.
- Automatic monthly ML retraining.
- Manual ML retraining from the dashboard.
- Dashboard authentication.
- Admin dashboard with charts and ML controls.
- Public iframe/widget without login.
- Basic system monitoring and error logging.
- API endpoints for dashboard and widget data.
- Configuration for library-specific values such as max occupancy and opening hours.

### 4.2 Out of Scope

The following are not required for the first version unless explicitly added later:

- Real-time video streaming from the Jetson.
- Person identification or face recognition.
- Tracking individual people.
- Mobile native app.
- Multi-library/multi-tenant support, unless needed by the library.
- Advanced staff scheduling features.
- Payment or booking functionality.
- Manual correction UI for every single sensor event, unless needed later.
- Complex custom ML model design if a simpler forecasting model performs adequately.

---

## 5. Users and Roles

### 5.1 Public Website Visitor

A public visitor sees the embeddable widget on the library website.

They can view:

- Current occupancy.
- Occupancy compared to maximum capacity.
- Expected occupancy for the next hours.
- Expected occupancy for the next days.

They cannot:

- Log in.
- Change settings.
- Trigger retraining.
- Access raw data.
- Access admin dashboard features.

### 5.2 Library Staff / Admin User

A library staff/admin user can log in to the dashboard.

They can view:

- Current occupancy.
- Historical occupancy.
- Forecasts.
- Model status.
- Ingestion status.
- System health.

They can manage:

- Manual retraining.
- Basic ML configuration options.
- Max occupancy.
- Opening hours.
- Semester break periods.
- Public widget settings.

### 5.3 System Administrator / Developer

A system administrator or developer can manage:

- Deployment.
- Environment variables.
- API keys.
- Database access.
- Logs and monitoring.
- External integrations.
- Backup and restore procedures.

---

## 6. System Architecture

The system should consist of the following logical components:

1. **Jetson Device**
   - Counts people entering and leaving.
   - Sends count data to backend webhook.

2. **Backend API**
   - Receives Jetson data.
   - Provides API endpoints for dashboard and widget.
   - Handles authentication and authorization.
   - Provides ML control endpoints.

3. **Database**
   - Stores raw Jetson events.
   - Stores processed half-hour occupancy aggregates.
   - Stores forecasts.
   - Stores model metadata.
   - Stores configuration data.

4. **Data Processing Layer**
   - Validates incoming data.
   - Aggregates events into half-hour buckets.
   - Calculates occupancy.
   - Handles missing or delayed data.
   - Joins occupancy data with weather, semester, holiday, and calendar features.

5. **ML Forecasting Service**
   - Trains forecasting models.
   - Generates future occupancy predictions.
   - Supports automatic monthly retraining.
   - Supports manual retraining.
   - Tracks model versions and performance metrics.

6. **Dashboard Frontend**
   - Login-protected web interface.
   - Shows charts and system controls.
   - Recommended stack: Next.js or Vite with shadcn/ui.

7. **Public Iframe / Widget**
   - Passwordless, read-only public view.
   - Embeddable on the library website.
   - Uses restricted public API endpoints.

8. **Scheduler / Background Jobs**
   - Monthly model retraining.
   - Periodic forecast generation.
   - Weather data updates.
   - Data cleanup and maintenance tasks.

---

## 7. Functional Requirements

## 7.1 Jetson Data Ingestion

### REQ-INGEST-001: Protected Webhook Endpoint

The backend must expose a protected webhook endpoint for the Jetson device.

Example endpoint:

```text
POST /api/v1/ingest/jetson/occupancy