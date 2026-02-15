# Replit Task: Restore EmployeeForm/EmployeeDetail Architecture

## Background
During the recent merge, EmployeeForm.tsx regained sections that should only exist in EmployeeDetail.tsx for inline editing. This duplicates functionality and needs to be corrected.

**Reference commits for intended architecture:**
- `bb71cc2` - Moved Safety, Emergency, Support to EmployeeDetail
- `400f843` - Moved Certifications to EmployeeDetail  
- `ec16867` - Moved Account Access to EmployeeForm

## Target Architecture

### EmployeeForm.tsx (Edit Modal)
Should ONLY contain:
- Basic Information (name, role, profile picture, active status)
- System Access Settings (username, password)
- Account Access/Invitation (for Job Coach/Guardian roles)

### EmployeeDetail.tsx (Profile View)
Should contain inline editing for:
- Safety/Allergies ✓ (already exists)
- Emergency Contacts ✓ (already exists)
- Service Provider ← **NEW - needs to be added**
- Support Info ✓ (already exists)
- Certifications ✓ (already exists)
- Plus: Goals, Notes, Relationships, Check-Ins

---

## Task 1: Remove Duplicate Sections from EmployeeForm.tsx

### Sections to Remove (in JSX):
| Section | Approximate Lines |
|---------|------------------|
| Safety Information | 643-687 |
| Emergency Contacts | 689-748 |
| Service Provider | 750-822 |
| About Me - Support Information | 824-952 |
| Promotion Certifications | 954-1137 |

### State Variables to Remove:
```typescript
// Lines 27-36 - Remove these certification states:
const employeeCerts = ...
const hasMentorCert = ...
const hasShiftLeadCert = ...
const [showCertForm, setShowCertForm] = ...
const [certType, setCertType] = ...
const [certDate, setCertDate] = ...
const [certNotes, setCertNotes] = ...
const [savingCert, setSavingCert] = ...
const [checklistAnswers, setChecklistAnswers] = ...
```

### Arrays to Remove:
```typescript
// Lines 38-158 - Remove these checklist arrays:
const mentorChecklistItems = [...]
const shiftManagerCategories = [...]
```

### Functions to Remove:
```typescript
// Remove these functions:
getChecklistItems()
getPassingScore()
calculateScore()
handleSaveCertification()
```

### formData Fields to Remove:
```typescript
// In useState for formData, remove these fields:
allergies: [''],
emergencyContacts: [{ name: '', relationship: '', phone: '' }],
interestsMotivators: [''],
challenges: [''],
regulationStrategies: [''],
hasServiceProvider: false,
serviceProviders: [{ name: '', type: '' }]
```

### Helper Functions to Remove:
```typescript
// Remove these array manipulation helpers (if not used elsewhere):
updateArrayItem()
removeArrayItem()
addArrayItem()
addEmergencyContact()
removeEmergencyContact()
updateEmergencyContact()
```

### Imports to Clean Up:
Remove unused imports after removing sections:
- `certifications` from useData (if no longer needed)
- Icons no longer used: `AlertTriangle`, `Phone`, `Heart`, `Brain`, `Building2`, `Award`, `Star`, `ChevronDown`, `ChevronUp` (verify each)

---

## Task 2: Add Service Provider Inline Editing to EmployeeDetail.tsx

Follow the pattern of existing inline editing sections (Safety, Emergency Contacts, Support Info).

### Add State Variables:
```typescript
// Add near other editing states (around line 32-44):
const [editingServiceProvider, setEditingServiceProvider] = useState(false);
const [serviceProviderForm, setServiceProviderForm] = useState({
  hasServiceProvider: false,
  providers: [{ name: '', type: '' }]
});
```

### Initialize Form Data in useEffect:
```typescript
// In the useEffect that initializes form data (around line 274-284), add:
setServiceProviderForm({
  hasServiceProvider: employee.hasServiceProvider || false,
  providers: employee.serviceProviders?.length > 0 
    ? [...employee.serviceProviders] 
    : [{ name: '', type: '' }]
});
```

### Add Save Handler:
```typescript
const handleSaveServiceProvider = async () => {
  setSavingProfile(true);
  try {
    await updateEmployee(employeeId, {
      hasServiceProvider: serviceProviderForm.hasServiceProvider,
      serviceProviders: serviceProviderForm.hasServiceProvider 
        ? serviceProviderForm.providers.filter(p => p.name.trim() !== '')
        : []
    });
    setEditingServiceProvider(false);
  } catch (error) {
    console.error('Error saving service provider:', error);
  } finally {
    setSavingProfile(false);
  }
};

const handleCancelServiceProvider = () => {
  setServiceProviderForm({
    hasServiceProvider: employee?.hasServiceProvider || false,
    providers: employee?.serviceProviders?.length > 0 
      ? [...employee.serviceProviders] 
      : [{ name: '', type: '' }]
  });
  setEditingServiceProvider(false);
};
```

### Add JSX Section (place after Emergency Contacts, before Support Info):
```tsx
{/* Service Provider - Only show for Super Scoopers */}
{employee.role === 'Super Scooper' && (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Building2 className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-gray-900">Service Provider</h2>
      </div>
      {canEdit && !editingServiceProvider && (
        <button
          onClick={() => setEditingServiceProvider(true)}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Edit service provider"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>

    {editingServiceProvider ? (
      <div className="space-y-4">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={serviceProviderForm.hasServiceProvider}
            onChange={(e) => setServiceProviderForm(prev => ({ 
              ...prev, 
              hasServiceProvider: e.target.checked 
            }))}
            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Has a service provider
          </span>
        </label>

        {serviceProviderForm.hasServiceProvider && (
          <div className="space-y-3 pl-2 border-l-2 border-indigo-200">
            {serviceProviderForm.providers.map((provider, index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  value={provider.name}
                  onChange={(e) => {
                    const updated = [...serviceProviderForm.providers];
                    updated[index] = { ...updated[index], name: e.target.value };
                    setServiceProviderForm(prev => ({ ...prev, providers: updated }));
                  }}
                  className={`flex-1 ${INPUT_BASE_CLASSES}`}
                  placeholder="Agency or person name"
                />
                {serviceProviderForm.providers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setServiceProviderForm(prev => ({
                        ...prev,
                        providers: prev.providers.filter((_, i) => i !== index)
                      }));
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setServiceProviderForm(prev => ({
                  ...prev,
                  providers: [...prev.providers, { name: '', type: '' }]
                }));
              }}
              className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add Provider</span>
            </button>
          </div>
        )}

        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleSaveServiceProvider}
            disabled={savingProfile}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{savingProfile ? 'Saving...' : 'Save'}</span>
          </button>
          <button
            onClick={handleCancelServiceProvider}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div>
        {employee.hasServiceProvider && employee.serviceProviders?.length > 0 ? (
          <ul className="space-y-2">
            {employee.serviceProviders.map((provider, index) => (
              <li key={index} className="flex items-center space-x-2 text-gray-700">
                <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                <span>{provider.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 italic">No service provider</p>
        )}
      </div>
    )}
  </div>
)}
```

### Add Required Import:
Make sure `Building2` icon is imported from lucide-react.

---

## Testing Checklist

- [ ] Create new employee via EmployeeForm - only shows Basic Info, System Access, Account Access
- [ ] Edit existing employee - same sections only
- [ ] View Super Scooper profile - shows Service Provider section with edit capability
- [ ] Edit Service Provider inline - save works correctly
- [ ] Edit Safety/Allergies inline - still works
- [ ] Edit Emergency Contacts inline - still works
- [ ] Edit Support Info inline - still works
- [ ] Certifications section - still works on profile view

---

## Backend Note
The backend already supports all these operations. The `updateEmployee()` function in DataContext.tsx properly maps frontend camelCase to backend snake_case. No backend changes are needed.
