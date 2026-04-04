Project Name: FinPilot – AI-Powered Financial Intelligence System

Goal:
Build a full-stack personal finance application that helps users track transactions, manage budgets, view dashboards, upload bulk transactions, generate reports, support multi-currency handling, simulate bank sync, and provide AI-powered savings recommendations.

Core requirements:

- Transaction CRUD
- Income and expense tracking
- Categories and subcategories
- Dashboard with totals, charts, and date filters
- Budget tracking by category
- CSV upload with validation
- PDF report generation
- Multi-currency support with base currency conversion at write time
- Mock bank sync endpoint
- AI savings planner using pre-aggregated structured data

Architecture principles:

- Clear separation of frontend, backend, services, data access, and AI layer
- Deterministic financial calculations; AI only for insights/recommendations
- AI should never receive raw transaction dumps if structured summaries can be sent instead
- Base currency amount should be stored at write time for performance
- Dashboard aggregations can be computed on demand for now
- Code should be modular, interview-ready, and easy to explain

Non-functional requirements:

- Clean folder structure
- Input validation
- Error handling
- Extensible design
- Reasonable defaults over overengineering

Priority:
Build a working vertical slice first, then expand.
