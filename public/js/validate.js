/* Input validation module (single purpose).
 *
 * Shared by the browser and the server so both apply the SAME rules.
 *   Layer 1 (browser): cheap local checks run before any request is sent.
 *   Layer 2 (server) : the same checks run again, followed by the database checks.
 *
 * Every function returns '' when the value is valid, or the user-facing error message when it is not.
 * The six check types of the IT 317 validation matrix are marked as [1] to [6]:
 *   [1] Completeness  [2] Check digit  [3] Format  [4] Range  [5] Consistency  [6] Database (server only)
 */
(function (g) {
    'use strict';

    const PROGRAMS = [
        'BS Information Technology', 'BS Computer Engineering', 'BS Civil Engineering', 'BS Electrical Engineering',
        'BS Mechanical Engineering', 'BS Hospitality Management', 'BS Tourism Management', 'BS Business Administration',
        'BS Entrepreneurship', 'BS Agriculture', 'BS Fisheries', 'Bachelor of Elementary Education',
        'Bachelor of Secondary Education', 'BS Criminology', 'Other program'
    ];
    const OFFICES = [
        'Office of the President', 'Registrar', 'Accounting / Cashier', 'Library', 'Guidance and Counseling',
        'Human Resource', 'Clinic', 'Security', 'Maintenance', 'Faculty / Academic Department', 'Cafeteria', 'Other office'
    ];
    const PAYMENTS = ['cash', 'gcash'];
    const LIMITS = { qty: [1, 10], password: [8, 100], name: [2, 60] };

    const blank = v => v === null || v === undefined || String(v).trim() === '';
    const listFor = type => (type === 'student' ? PROGRAMS : OFFICES);

    /* [2] Luhn (modulus 10) check digit */
    const luhnDigit = payload => {
        let sum = 0;
        String(payload).split('').reverse().forEach((c, i) => {
            let n = Number(c);
            if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
            sum += n;
        });
        return (10 - (sum % 10)) % 10;
    };
    const luhnOk = full => /^\d{2,}$/.test(full) && luhnDigit(full.slice(0, -1)) === Number(full.slice(-1));
    const refNo = no => String(no) + luhnDigit(no); // 11-digit order number + check digit = 12-digit pickup reference

    const isDate = v => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        const d = new Date(v + 'T00:00:00Z');
        return !isNaN(d) && d.toISOString().slice(0, 10) === v;
    };

    const V = {
        PROGRAMS, OFFICES, PAYMENTS, LIMITS, luhnDigit, luhnOk, refNo, listFor, blank, isDate,

        /* input masks: they shape what is typed so characters cannot be misplaced */
        maskId: (v, type) => type === 'student'
            ? String(v).replace(/\D/g, '').slice(0, 9).replace(/^(\d{4})(\d)/, '$1-$2')
            : String(v).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20),
        maskContact: v => String(v).replace(/\D/g, '').slice(0, 11).replace(/^(\d{4})(\d{1,3})/, '$1 $2').replace(/^(\d{4} \d{3})(\d)/, '$1 $2'),

        name: v => blank(v) ? 'Full Name is required.'
            : !/^\p{L}[\p{L} .'\-]{1,59}$/u.test(String(v).trim()) ? 'Full Name must be 2 to 60 letters (spaces, . \' and - are allowed).' : '', // [1][3]

        idNumber: (v, type) => blank(v) ? 'ID Number is required.' // [1]
            : type === 'student'
                ? (/^\d{4}-\d{4,5}$/.test(String(v).trim()) ? '' : 'Student ID must follow the format YYYY-NNNNN (example: 2024-00123).') // [3]
                : (/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(String(v).trim()) && String(v).trim().length >= 3 && String(v).trim().length <= 20 ? '' : 'ID Number may contain letters, numbers and dashes only (3 to 20 characters).'),

        email: (v, domain) => {
            if (blank(v)) return 'CSPC Email is required.'; // [1]
            const e = String(v).trim().toLowerCase();
            if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return 'Please enter a valid email address (name@domain).'; // [3]
            const host = e.split('@')[1];
            return !domain || host === domain || host.endsWith('.' + domain) ? '' : 'Use your CSPC email (ending in @' + domain + ').'; // [3]
        },

        contact: v => blank(v) ? '' : /^(09|\+639)\d{9}$/.test(String(v).replace(/[\s-]/g, '')) ? '' : 'Contact No. must be a Philippine mobile number (09XX XXX XXXX).', // [3] optional field

        dept: (v, type) => blank(v) ? (type === 'student' ? 'Select your course / program.' : 'Select your department / office.') // [1]
            : listFor(type).includes(String(v).trim()) ? '' : 'Choose a course / department / office from the list.', // [3]

        password: v => blank(v) ? 'Password is required.' // [1]
            : String(v).length < LIMITS.password[0] || String(v).length > LIMITS.password[1] ? 'Password must be ' + LIMITS.password[0] + ' to ' + LIMITS.password[1] + ' characters.' // [4]
                : /[A-Za-z]/.test(v) && /\d/.test(v) ? '' : 'Password needs both letters and numbers.', // [3]

        confirm: (a, b) => blank(b) ? 'Confirm Password is required.' : a === b ? '' : 'Passwords do not match.', // [1][5]

        qty: n => Number.isInteger(Number(n)) && Number(n) >= LIMITS.qty[0] && Number(n) <= LIMITS.qty[1] ? '' : 'Quantity must be between ' + LIMITS.qty[0] + ' and ' + LIMITS.qty[1] + '.', // [4]

        payment: v => PAYMENTS.includes(v) ? '' : 'Choose a payment method.', // [1][3]

        terms: ok => ok ? '' : 'Please agree to the terms and conditions.', // [1]

        /* [2] manual pickup reference typed by staff: 11-digit order number + 1 Luhn check digit */
        orderRef: v => {
            const c = String(v).replace(/\s/g, '');
            if (!c) return 'Pickup reference is required.'; // [1]
            if (!/^\d{12}$/.test(c)) return 'Pickup reference must be 12 digits (order number + check digit).'; // [3]
            return luhnOk(c) ? '' : 'Invalid pickup reference checksum. Please check for typing errors.'; // [2]
        },

        date: v => blank(v) ? 'Date is required.' : isDate(v) ? '' : 'Enter the date as YYYY-MM-DD.', // [1][3]

        dateRange: (from, to) => { // [5]
            const a = V.date(from) || V.date(to);
            if (a) return a;
            if (to < from) return 'End date cannot precede start date.';
            return (new Date(to) - new Date(from)) / 864e5 > 366 ? 'Date range cannot exceed 366 days.' : '';
        },

        /* whole-form check for registration: returns { field: message } for every invalid field */
        register: (o, domain) => {
            const r = {
                name: V.name(o.name), idn: V.idNumber(o.idn, o.type), contact: V.contact(o.contact),
                dept: V.dept(o.dept, o.type), email: V.email(o.email, domain),
                password: V.password(o.password), password2: V.confirm(o.password, o.password2)
            };
            Object.keys(r).forEach(k => { if (!r[k]) delete r[k]; });
            return r;
        }
    };

    g.V = V;
    if (typeof module !== 'undefined' && module.exports) module.exports = V;
})(typeof window !== 'undefined' ? window : globalThis);
