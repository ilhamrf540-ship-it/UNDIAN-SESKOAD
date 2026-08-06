/**
 * UNDIAN DOORPRIZE - Premium Application Logic
 * Client-side only. Uses LocalStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
    // === INITIAL STATE & CONFIG ===
    let state = {
        peserta: [],
        hadiah: [],
        pemenang: [],
        settings: {
            logo: '',
            bg: '',
            volume: 0.7,
            soundEnabled: true,
            animEnabled: true,
            drawMode: 'rolling', // 'rolling' or 'wheel'
            uniqueWinner: true,
            autoReducePrize: true,
            noDuplicates: true
        },
        eventConfig: {
            name: "SESKOAD AWARD 2025",
            slogan: "Membangun Sinergi, Mengukir Prestasi",
            org: "SESKOAD - INFOLAHTA",
            date: "Sabtu, 24 Mei 2025"
        }
    };

    // Safe Modal Hide helper (fixes Bootstrap 5 stuck backdrop bug)
    function hideModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        let inst = bootstrap.Modal.getInstance(el);
        if (!inst) {
            inst = new bootstrap.Modal(el);
        }
        inst.hide();
        // Force cleanup backdrop if stuck
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    // Image compressor helper to prevent LocalStorage QuotaExceededError
    function compressImage(file, maxDimension, quality, callback) {
        if (!file.type.startsWith('image/')) {
            callback('');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                callback(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Load state from local storage or set defaults
    function loadState() {
        const stored = localStorage.getItem('undian_doorprize_state');
        if (stored) {
            try {
                state = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing local storage state", e);
            }
        } else {
            // Seed default data for instant wow effect
            state.peserta = [
                { id: 1, noPeserta: "0001", nama: "Ricky Hartono", instansi: "Seskoad", hp: "0812XXXXXXXX" },
                { id: 2, noPeserta: "0002", nama: "Dewi Lestari", instansi: "DISPENAD", hp: "0813XXXXXXXX" },
                { id: 3, noPeserta: "0003", nama: "Andi Pratama", instansi: "Pusdiklat", hp: "0814XXXXXXXX" },
                { id: 4, noPeserta: "0004", nama: "Siti Nurhaliza", instansi: "Seskoad", hp: "0815XXXXXXXX" },
                { id: 5, noPeserta: "0005", nama: "Budi Santoso", instansi: "INFOLAHTA", hp: "0816XXXXXXXX" },
                { id: 6, noPeserta: "0006", nama: "Ahmad Dahlan", instansi: "Seskoad", hp: "" },
                { id: 7, noPeserta: "0007", nama: "Eka Wulandari", instansi: "DISPENAD", hp: "" },
                { id: 8, noPeserta: "0008", nama: "Gideon Simanjuntak", instansi: "Pusdiklat", hp: "" }
            ];
            state.hadiah = [
                { id: 1, tingkat: "Grand Prize", nama: "Honda PCX 160 ABS", gambar: "", jumlah: 1, sisa: 1, desc: "Motor Premium dari Honda" },
                { id: 2, tingkat: "Doorprize", nama: "iPhone 15 Pro 256GB", gambar: "", jumlah: 1, sisa: 1, desc: "Smartphone Apple model terbaru" },
                { id: 3, tingkat: "Doorprize", nama: "Laptop ASUS ROG", gambar: "", jumlah: 1, sisa: 1, desc: "Laptop gaming performa tinggi" },
                { id: 4, tingkat: "Doorprize", nama: "Smart TV 55 Inch", gambar: "", jumlah: 2, sisa: 2, desc: "TV pintar layar bioskop" },
                { id: 5, tingkat: "Hiburan", nama: "Voucher Belanja 500K", gambar: "", jumlah: 5, sisa: 5, desc: "Voucher belanja gratis" }
            ];
            saveState();
        }
        state.specialWinners = state.specialWinners || [];
        state.settings.drawSpeed = state.settings.drawSpeed || 'normal';
    }

    function saveState() {
        try {
            localStorage.setItem('undian_doorprize_state', JSON.stringify(state));
        } catch (e) {
            console.error("Gagal menyimpan ke localStorage:", e);
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                Swal.fire({
                    title: 'Penyimpanan Penuh',
                    text: 'Ukuran file/gambar yang Anda masukkan terlalu besar sehingga melebihi batas memori browser (5MB). Aplikasi otomatis mengompres gambar Anda, silakan coba gambar yang lebih kecil.',
                    icon: 'warning'
                });
            }
        }
    }

    // === BROADCAST CHANNEL — Kirim perintah ke display.html ===
    const displayChannel = new BroadcastChannel('undian_display_channel');
    let displayWindow = null;

    function broadcastToDisplay(type, payload = {}) {
        try { displayChannel.postMessage({ type, payload }); } catch(e) {}
    }

    function openDisplayWindow() {
        if (!displayWindow || displayWindow.closed) {
            displayWindow = window.open('display.html', 'UndianDisplay',
                'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes');
        } else {
            displayWindow.focus();
        }
        // Give window time to load then push current state
        setTimeout(pushStateToDisplay, 1200);
    }

    function pushStateToDisplay() {
        broadcastToDisplay('INIT', {
            bg:          state.settings.bg   || '',
            logo:        state.settings.logo || '',
            name:        state.eventConfig.name || 'UNDIAN DOORPRIZE',
            org:         state.eventConfig.org  || '',
            marqueeText: state.eventConfig.marqueeText || '',
            volume:      state.settings.volume,
            sound:       state.settings.soundEnabled,
            anim:        state.settings.animEnabled,
            drawMode:    state.settings.drawMode || 'rolling',
            drawSpeed:   state.settings.drawSpeed || 'normal'
        });
        
        if (state.settings.drawMode === 'wheel') {
            const segments = readyParticipants.slice(0, 12).map(p => ({ nama: p.nama, instansi: p.instansi }));
            broadcastToDisplay('INIT_WHEEL', { segments });
        }

        if (selectedPrize) {
            broadcastToDisplay('UPDATE_PRIZE', {
                tier: selectedPrize.tingkat,
                name: selectedPrize.nama,
                img:  selectedPrize.gambar || ''
            });
        }
    }

    // === WEB AUDIO API SYNTHESIZER (No external audio files needed) ===
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playSound(type) {
        if (!state.settings.soundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const volumeNode = ctx.createGain();
            volumeNode.gain.setValueAtTime(state.settings.volume, ctx.currentTime);
            volumeNode.connect(ctx.destination);

            if (type === 'tick') {
                // Short click sound for scrolling name
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

                osc.connect(gain);
                gain.connect(volumeNode);
                osc.start();
                osc.stop(ctx.currentTime + 0.06);
            } else if (type === 'countdown') {
                // Short high pip
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.5, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

                osc.connect(gain);
                gain.connect(volumeNode);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            } else if (type === 'fanfare') {
                // Majestic celebratory tone sequence
                const now = ctx.currentTime;
                const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C chord arpeggio
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.15);
                    
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.15 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.8);
                    
                    osc.connect(gain);
                    gain.connect(volumeNode);
                    osc.start(now + idx * 0.15);
                    osc.stop(now + idx * 0.15 + 0.9);
                });
            }
        } catch (err) {
            console.error("Audio error", err);
        }
    }

    // === TAB ROUTING & AUTH ===
    let isAdmin = sessionStorage.getItem('undian_admin_logged') === 'true';

    // --- Credential helpers (stored separately in localStorage) ---
    const CRED_KEY = 'undian_admin_credentials';

    function getCredentials() {
        try {
            const stored = localStorage.getItem(CRED_KEY);
            if (stored) return JSON.parse(stored);
        } catch(e) {}
        return { username: 'admin', password: 'admin123' };
    }

    function saveCredentials(username, password) {
        localStorage.setItem(CRED_KEY, JSON.stringify({ username, password }));
    }

    function refreshCredentialUI() {
        const creds = getCredentials();
        const userEl = document.getElementById('showCurrentUser');
        const maskEl = document.getElementById('showCurrentPassMask');
        if (userEl) userEl.innerText = creds.username;
        if (maskEl) maskEl.innerText = '•'.repeat(Math.min(creds.password.length, 10));
    }

    function checkLogin() {
        if (!isAdmin) {
            const loginModalEl = document.getElementById('loginModal');
            const modal = new bootstrap.Modal(loginModalEl);
            modal.show();
            // Pre-fill username from saved creds
            const creds = getCredentials();
            document.getElementById('adminUser').value = creds.username;
        } else {
            document.getElementById('appContainer').classList.remove('d-none');
            initApp();
        }
    }

    // Reset credentials immediately on load to ensure user can log in right now
    saveCredentials('admin', 'admin123');

    // Login Form Submit — uses dynamic credentials from localStorage
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('adminUser').value.trim();
        const pass = document.getElementById('adminPass').value;
        const creds = getCredentials();
        if (user === creds.username && pass === creds.password) {
            isAdmin = true;
            sessionStorage.setItem('undian_admin_logged', 'true');
            hideModal('loginModal');
            document.getElementById('appContainer').classList.remove('d-none');
            initApp();
            Swal.fire({
                title: 'Berhasil Masuk',
                text: `Selamat datang, ${creds.username}!`,
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } else {
            Swal.fire({
                title: 'Gagal Masuk',
                text: 'Username atau Password salah!',
                icon: 'error',
                customClass: {
                    popup: 'swal2-popup-custom',
                    title: 'swal2-title-custom'
                }
            });
        }
    });

    // Forgot Password Handler
    const btnForgot = document.getElementById('btnForgotPassword');
    if (btnForgot) {
        btnForgot.addEventListener('click', (e) => {
            e.preventDefault();
            saveCredentials('admin', 'admin123');
            document.getElementById('adminUser').value = 'admin';
            document.getElementById('adminPass').value = 'admin123';
            
            Swal.fire({
                title: 'Kredensial Direset!',
                html: 'Username dan password admin telah di-reset ke default:<br><br><b>Username:</b> admin<br><b>Password:</b> admin123',
                icon: 'info',
                confirmButtonColor: '#D4AF37'
            });
        });
    }


    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        isAdmin = false;
        sessionStorage.removeItem('undian_admin_logged');
        window.location.reload();
    });

    // Navigation switching
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.app-section').forEach(sec => sec.classList.add('d-none'));
            const targetSection = document.getElementById(`section-${section}`);
            if (targetSection) {
                targetSection.classList.remove('d-none');
            }
        });
    });

    // === INITIALIZATION & VIEW UPDATES ===
    function initApp() {
        loadState();
        updateDashboardStats();
        renderPesertaTable();
        renderHadiahTable();
        populatePrizeDropdowns();
        renderWinnersTable();
        applyCustomStyling();
        refreshCredentialUI();
        populateSpecialWinnerDropdowns();
        renderSpecialWinnersTable();
        
        // Load initial draw speed
        const speedEl = document.getElementById('drawSpeedInput');
        if (speedEl) speedEl.value = state.settings.drawSpeed || 'normal';
    }

    function applyCustomStyling() {
        if (state.settings.bg) {
            document.body.style.backgroundImage = `url(${state.settings.bg})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        } else {
            document.body.style.backgroundImage = '';
        }
        // Push new styling to display window
        pushStateToDisplay();
        if (state.settings.logo) {
            document.getElementById('appLogo').src = state.settings.logo;
            document.getElementById('tvLogo').src = state.settings.logo;
        }
        // Event titles
        document.getElementById('mainTitleText').innerText = state.eventConfig.name;
        document.getElementById('eventNameDisplay').innerText = state.eventConfig.name;
        document.getElementById('eventOrgDisplay').innerText = state.eventConfig.org;
        document.getElementById('eventDateDisplay').innerText = state.eventConfig.date;
        document.getElementById('tvEventName').innerText = state.eventConfig.name;
        document.getElementById('tvEventOrg').innerText = state.eventConfig.org;

        // Editable marquee
        const marqueeEl = document.getElementById('tvMarqueeText');
        if (marqueeEl) {
            marqueeEl.innerText = state.eventConfig.marqueeText || "Selamat kepada pemenang! Silakan menghubungi panitia untuk mengambil hadiah. Serta selamat menyaksikan keseruan undian hari ini.";
        }
        const cfgMarquee = document.getElementById('cfgEventMarquee');
        if (cfgMarquee) {
            cfgMarquee.value = state.eventConfig.marqueeText || "Selamat kepada pemenang! Silakan menghubungi panitia untuk mengambil hadiah. Serta selamat menyaksikan keseruan undian hari ini.";
        }
    }

    function updateDashboardStats() {
        document.getElementById('statPeserta').innerText = state.peserta.length;
        document.getElementById('statHadiah').innerText = state.hadiah.reduce((acc, h) => acc + h.jumlah, 0);
        const sisa = state.hadiah.reduce((acc, h) => acc + h.sisa, 0);
        document.getElementById('statHadiahSisa').innerText = sisa;
        document.getElementById('statPemenang').innerText = state.pemenang.length;

        // Progress wheel
        const total = state.hadiah.reduce((acc, h) => acc + h.jumlah, 0);
        const terbagi = total - sisa;
        const pct = total > 0 ? Math.round((terbagi / total) * 100) : 0;
        
        document.getElementById('progressPct').innerText = `${pct}%`;
        document.getElementById('progressCircle').setAttribute('stroke-dasharray', `${pct}, 100`);
        document.getElementById('lblHadiahTerbagi').innerText = terbagi;
        document.getElementById('lblHadiahSisa').innerText = sisa;
    }

    // === DATA PESERTA MANAGEMENT ===
    function renderPesertaTable() {
        const tbody = document.getElementById('tbodyPeserta');
        tbody.innerHTML = '';
        const searchVal = document.getElementById('searchPeserta').value.toLowerCase();
        
        const filtered = state.peserta.filter(p => 
            p.nama.toLowerCase().includes(searchVal) || 
            p.instansi.toLowerCase().includes(searchVal) ||
            p.noPeserta.toLowerCase().includes(searchVal)
        );

        document.getElementById('countTotalPeserta').innerText = filtered.length;

        filtered.forEach((p, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><span class="badge bg-dark border border-secondary">${p.noPeserta}</span></td>
                <td class="fw-bold">${p.nama}</td>
                <td>${p.instansi}</td>
                <td>${p.hp || '-'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-warning btn-edit-peserta" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-del-peserta" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add Listeners
        document.querySelectorAll('.btn-edit-peserta').forEach(btn => {
            btn.addEventListener('click', () => editPeserta(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.btn-del-peserta').forEach(btn => {
            btn.addEventListener('click', () => deletePeserta(btn.getAttribute('data-id')));
        });
    }

    document.getElementById('searchPeserta').addEventListener('input', renderPesertaTable);

    // Tambah Peserta
    document.getElementById('formTambahPeserta').addEventListener('submit', (e) => {
        e.preventDefault();
        const noVal = document.getElementById('inputNoPeserta').value || String(state.peserta.length + 1).padStart(4, '0');
        const nama = document.getElementById('inputNamaPeserta').value;
        const instansi = document.getElementById('inputInstansiPeserta').value;
        const hp = document.getElementById('inputHpPeserta').value;

        // Duplicate Check
        if (state.settings.noDuplicates && state.peserta.some(p => p.noPeserta === noVal)) {
            Swal.fire('Error', 'Nomor peserta sudah ada!', 'error');
            return;
        }

        state.peserta.push({
            id: Date.now(),
            noPeserta: noVal,
            nama,
            instansi,
            hp
        });
        saveState();
        initApp();
        hideModal('modalTambahPeserta');
        document.getElementById('formTambahPeserta').reset();
    });

    function deletePeserta(id) {
        Swal.fire({
            title: 'Hapus Peserta?',
            text: "Peserta akan dihapus permanen!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, Hapus'
        }).then((result) => {
            if (result.isConfirmed) {
                state.peserta = state.peserta.filter(p => p.id != id);
                saveState();
                initApp();
            }
        });
    }

    function editPeserta(id) {
        const p = state.peserta.find(x => x.id == id);
        if (!p) return;
        Swal.fire({
            title: 'Edit Peserta',
            html: `
                <input id="editNama" class="swal2-input" placeholder="Nama Lengkap" value="${p.nama}">
                <input id="editInstansi" class="swal2-input" placeholder="Instansi" value="${p.instansi}">
                <input id="editHp" class="swal2-input" placeholder="No HP" value="${p.hp || ''}">
            `,
            showCancelButton: true,
            confirmButtonText: 'Simpan',
            preConfirm: () => {
                return {
                    nama: document.getElementById('editNama').value,
                    instansi: document.getElementById('editInstansi').value,
                    hp: document.getElementById('editHp').value
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                p.nama = result.value.nama;
                p.instansi = result.value.instansi;
                p.hp = result.value.hp;
                saveState();
                initApp();
            }
        });
    }

    // Download Template Excel
    const btnDownloadTemplateExcel = document.getElementById('btnDownloadTemplateExcel');
    if (btnDownloadTemplateExcel) {
        btnDownloadTemplateExcel.addEventListener('click', () => {
            const templateData = [
                { "Nomor Peserta": "0001", "Nama": "Budi Santoso", "Instansi": "Seskoad", "HP": "08123456789" },
                { "Nomor Peserta": "0002", "Nama": "Siti Aminah", "Instansi": "Infolahta", "HP": "08234567890" },
                { "Nomor Peserta": "0003", "Nama": "Eko Wibowo", "Instansi": "Dispenad", "HP": "08345678901" }
            ];
            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Template Peserta");
            XLSX.writeFile(workbook, "template_peserta_undian.xlsx");
        });
    }

    // CSV/Excel Import
    document.getElementById('importExcelPeserta').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            rows.forEach((row, idx) => {
                const noPeserta = row['Nomor Peserta'] || row['no'] || String(state.peserta.length + 1).padStart(4, '0');
                const nama = row['Nama'] || row['nama'] || row['Nama Lengkap'] || '';
                const instansi = row['Instansi'] || row['instansi'] || '';
                const hp = row['HP'] || row['hp'] || row['No. HP'] || '';
                if (nama) {
                    state.peserta.push({ id: Date.now() + idx, noPeserta, nama, instansi, hp });
                }
            });
            saveState();
            initApp();
            Swal.fire('Sukses', `Berhasil impor ${rows.length} peserta!`, 'success');
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('importCsvPeserta').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const lines = text.split('\n');
            let imported = 0;
            lines.forEach((line, idx) => {
                if (idx === 0 || !line.trim()) return; // skip header
                const cols = line.split(',');
                if (cols.length >= 2) {
                    const noPeserta = cols[0].trim();
                    const nama = cols[1].trim();
                    const instansi = cols[2] ? cols[2].trim() : '';
                    const hp = cols[3] ? cols[3].trim() : '';
                    state.peserta.push({ id: Date.now() + idx, noPeserta, nama, instansi, hp });
                    imported++;
                }
            });
            saveState();
            initApp();
            Swal.fire('Sukses', `Berhasil impor ${imported} peserta dari CSV!`, 'success');
        };
        reader.readAsText(file);
    });

    document.getElementById('btnHapusSemuaPeserta').addEventListener('click', () => {
        Swal.fire({
            title: 'Kosongkan Peserta?',
            text: "Semua peserta akan dihapus permanent!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Hapus Semua'
        }).then(res => {
            if (res.isConfirmed) {
                state.peserta = [];
                saveState();
                initApp();
            }
        });
    });

    // === DATA HADIAH MANAGEMENT ===
    function renderHadiahTable() {
        const tbody = document.getElementById('tbodyHadiah');
        tbody.innerHTML = '';
        state.hadiah.forEach((h, index) => {
            const img = h.gambar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><rect width="100%" height="100%" fill="%23222"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23D4AF37" font-size="8">Gift</text></svg>';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><span class="badge ${h.tingkat === 'Grand Prize' ? 'bg-gold text-dark' : h.tingkat === 'Doorprize' ? 'bg-primary' : 'bg-secondary'}">${h.tingkat}</span></td>
                <td class="fw-bold">${h.nama}</td>
                <td><img src="${img}" style="max-height: 40px; border-radius: 4px;"></td>
                <td>${h.jumlah}</td>
                <td><strong class="text-gold">${h.sisa}</strong></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-warning btn-edit-hadiah" data-id="${h.id}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger btn-del-hadiah" data-id="${h.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit-hadiah').forEach(btn => {
            btn.addEventListener('click', () => editHadiah(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.btn-del-hadiah').forEach(btn => {
            btn.addEventListener('click', () => deleteHadiah(btn.getAttribute('data-id')));
        });
    }

    // Tambah Hadiah
    document.getElementById('formTambahHadiah').addEventListener('submit', (e) => {
        e.preventDefault();
        const tingkat = document.getElementById('inputTingkatHadiah').value;
        const nama = document.getElementById('inputNamaHadiah').value;
        const jumlah = parseInt(document.getElementById('inputJumlahHadiah').value);
        const desc = document.getElementById('inputDescHadiah').value;
        const fileInput = document.getElementById('inputGambarHadiah');

        const saveHadiah = (base64Img) => {
            state.hadiah.push({
                id: Date.now(),
                tingkat,
                nama,
                jumlah,
                sisa: jumlah,
                desc,
                gambar: base64Img || ''
            });
            saveState();
            initApp();
            hideModal('modalTambahHadiah');
            document.getElementById('formTambahHadiah').reset();
        };

        if (fileInput.files && fileInput.files[0]) {
            // Compress prize image to max 400px at 0.7 quality to keep size small (~20-50KB)
            compressImage(fileInput.files[0], 400, 0.7, (base64Img) => {
                saveHadiah(base64Img);
            });
        } else {
            saveHadiah(null);
        }
    });

    // Download Template Excel Hadiah
    const btnDownloadTemplateHadiah = document.getElementById('btnDownloadTemplateHadiah');
    if (btnDownloadTemplateHadiah) {
        btnDownloadTemplateHadiah.addEventListener('click', () => {
            const templateData = [
                { "Tingkatan": "Doorprize", "Nama Hadiah": "Smart TV 55 Inch", "Jumlah": 2, "Deskripsi": "Smart TV LG 4K" },
                { "Tingkatan": "Hiburan", "Nama Hadiah": "Voucher Belanja 500K", "Jumlah": 10, "Deskripsi": "Voucher Indomaret" },
                { "Tingkatan": "Grand Prize", "Nama Hadiah": "Sepeda Motor", "Jumlah": 1, "Deskripsi": "Honda Beat" }
            ];
            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Template Hadiah");
            XLSX.writeFile(workbook, "template_hadiah_undian.xlsx");
        });
    }

    // Import Excel Hadiah
    const importExcelHadiah = document.getElementById('importExcelHadiah');
    if (importExcelHadiah) {
        importExcelHadiah.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                rows.forEach((row, idx) => {
                    const tingkat = row['Tingkatan'] || row['tingkatan'] || 'Doorprize';
                    const nama = row['Nama Hadiah'] || row['nama'] || row['Nama'] || '';
                    const jumlah = parseInt(row['Jumlah'] || row['jumlah'] || '1') || 1;
                    const desc = row['Deskripsi'] || row['deskripsi'] || '';
                    if (nama) {
                        state.hadiah.push({
                            id: Date.now() + idx + Math.random(),
                            tingkat,
                            nama,
                            jumlah,
                            sisa: jumlah,
                            desc,
                            gambar: '' // base64 empty
                        });
                    }
                });
                saveState();
                initApp();
                Swal.fire('Sukses', `Berhasil impor ${rows.length} hadiah!`, 'success');
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Export Excel Hadiah
    const btnExportHadiahExcel = document.getElementById('btnExportHadiahExcel');
    if (btnExportHadiahExcel) {
        btnExportHadiahExcel.addEventListener('click', () => {
            if (state.hadiah.length === 0) {
                Swal.fire('Info', 'Belum ada data hadiah untuk diekspor.', 'info');
                return;
            }
            const exportData = state.hadiah.map((h, idx) => ({
                "No": idx + 1,
                "Tingkatan": h.tingkat,
                "Nama Hadiah": h.nama,
                "Jumlah Unit": h.jumlah,
                "Sisa": h.sisa,
                "Deskripsi": h.desc
            }));
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data Hadiah");
            XLSX.writeFile(workbook, `daftar_hadiah_undian_${Date.now()}.xlsx`);
        });
    }

    // Hapus Semua Hadiah
    const btnHapusSemuaHadiah = document.getElementById('btnHapusSemuaHadiah');
    if (btnHapusSemuaHadiah) {
        btnHapusSemuaHadiah.addEventListener('click', () => {
            Swal.fire({
                title: 'Kosongkan Hadiah?',
                text: "Semua hadiah akan dihapus permanent!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Hapus Semua'
            }).then(res => {
                if (res.isConfirmed) {
                    state.hadiah = [];
                    saveState();
                    initApp();
                    Swal.fire('Terhapus', 'Semua data hadiah berhasil dikosongkan.', 'success');
                }
            });
        });
    }

    function deleteHadiah(id) {
        Swal.fire({
            title: 'Hapus Hadiah?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Hapus'
        }).then(res => {
            if (res.isConfirmed) {
                state.hadiah = state.hadiah.filter(h => h.id != id);
                saveState();
                initApp();
            }
        });
    }

    function editHadiah(id) {
        const h = state.hadiah.find(x => x.id == id);
        if (!h) return;
        Swal.fire({
            title: 'Edit Sisa Hadiah',
            html: `<input id="editSisaVal" type="number" class="swal2-input" value="${h.sisa}" min="0">`,
            showCancelButton: true,
            confirmButtonText: 'Simpan'
        }).then(res => {
            if (res.isConfirmed) {
                h.sisa = parseInt(document.getElementById('editSisaVal').value);
                saveState();
                initApp();
            }
        });
    }

    // === DRAW ENGINE ===
    let selectedPrize = null;
    let isDrawing = false;
    let rollTimer = null;
    let targetWinner = null;
    let readyParticipants = [];

    function populatePrizeDropdowns() {
        const select = document.getElementById('selectTargetHadiah');
        select.innerHTML = '<option value="">-- Pilih Target Hadiah --</option>';
        state.hadiah.forEach(h => {
            if (h.sisa > 0) {
                const opt = document.createElement('option');
                opt.value = h.id;
                opt.innerText = `[${h.tingkat}] ${h.nama} (Sisa: ${h.sisa})`;
                select.appendChild(opt);
            }
        });
    }

    document.getElementById('selectTargetHadiah').addEventListener('change', (e) => {
        const id = e.target.value;
        selectedPrize = state.hadiah.find(h => h.id == id);
        if (selectedPrize) {
            document.getElementById('selectedPrizeTier').innerText = selectedPrize.tingkat;
            document.getElementById('selectedPrizeName').innerText = selectedPrize.nama;
            document.getElementById('displayPrizeImg').src = selectedPrize.gambar
                || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="%23222"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23D4AF37" font-size="16">Gambar Hadiah</text></svg>';

            // Broadcast prize update to display window
            broadcastToDisplay('UPDATE_PRIZE', {
                tier: selectedPrize.tingkat,
                name: selectedPrize.nama,
                img:  selectedPrize.gambar || ''
            });

            calculateReadyParticipants();
            if (state.settings.drawMode === 'wheel') {
                initWheel();
            }
        } else {
            document.getElementById('selectedPrizeTier').innerText = 'NONE';
            document.getElementById('selectedPrizeName').innerText = 'Pilih hadiah terlebih dahulu';
        }
    });

    function calculateReadyParticipants() {
        let pool = [...state.peserta];
        
        // Filter unique winner
        if (state.settings.uniqueWinner) {
            const winnersList = state.pemenang.map(w => w.noPeserta);
            pool = pool.filter(p => !winnersList.includes(p.noPeserta));
        }

        readyParticipants = pool;
        document.getElementById('lblPesertaReady').innerText = `${readyParticipants.length} Peserta`;
        document.getElementById('lblPrizeQuantityReady').innerText = selectedPrize ? `${selectedPrize.sisa} unit` : '0 unit';
    }

    // Start / Stop mechanics
    document.getElementById('btnStartDraw').addEventListener('click', startDrawSequence);
    document.getElementById('btnStopDraw').addEventListener('click', stopDrawSequence);
    document.getElementById('btnRedraw').addEventListener('click', startDrawSequence);
    document.getElementById('btnResetDraw').addEventListener('click', () => {
        calculateReadyParticipants();
        document.getElementById('rollingList').innerHTML = '<div class="rolling-item">Mulai Pengundian</div>';
        document.getElementById('btnStartDraw').disabled = false;
        document.getElementById('btnStopDraw').disabled = true;
        document.getElementById('btnRedraw').disabled = true;
    });

    // Draw Mode Selector (Lucky wheel or rolling)
    document.getElementById('drawModeSelector').addEventListener('change', (e) => {
        state.settings.drawMode = e.target.value;
        saveState();
        if (state.settings.drawMode === 'wheel') {
            document.getElementById('wheelDrawContainer').classList.remove('d-none');
            document.getElementById('rollingDrawContainer').classList.add('d-none');
            initWheel();
        } else {
            document.getElementById('wheelDrawContainer').classList.add('d-none');
            document.getElementById('rollingDrawContainer').classList.remove('d-none');
        }
        broadcastToDisplay('UPDATE_MODE', { drawMode: state.settings.drawMode });
    });

    // --- Lucky Wheel Drawing Code ---
    let wheelAngle = 0;
    let wheelSpeed = 0;
    function initWheel() {
        const canvas = document.getElementById('wheelCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,320,320);
        
        // Draw segment slices
        const segments = readyParticipants.slice(0, 12); // Limit to 12 visible names on wheel
        
        // Kirim segmen peserta ke layar besar
        broadcastToDisplay('INIT_WHEEL', { segments: segments.map(p => ({ nama: p.nama, instansi: p.instansi })) });

        if (segments.length === 0) {
            ctx.fillStyle = '#D4AF37';
            ctx.font = '16px Outfit';
            ctx.fillText('Belum ada data', 110, 160);
            return;
        }

        const arc = (2 * Math.PI) / segments.length;
        segments.forEach((seg, i) => {
            ctx.beginPath();
            ctx.fillStyle = i % 2 === 0 ? '#1b1b1b' : '#2563EB';
            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = 2;
            ctx.arc(160, 160, 150, i * arc, (i + 1) * arc);
            ctx.lineTo(160, 160);
            ctx.fill();
            ctx.stroke();

            // Render Text
            ctx.save();
            ctx.translate(160, 160);
            ctx.rotate(i * arc + arc / 2);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Outfit';
            ctx.textAlign = 'right';
            ctx.fillText(seg.nama.substring(0, 12), 140, 5);
            ctx.restore();
        });
    }

    function startDrawSequence() {
        if (!selectedPrize) {
            Swal.fire('Perhatian', 'Silakan pilih target hadiah terlebih dahulu.', 'warning');
            return;
        }
        if (readyParticipants.length === 0) {
            Swal.fire('Perhatian', 'Tidak ada peserta yang memenuhi syarat undian!', 'warning');
            return;
        }

        document.getElementById('btnStartDraw').disabled = true;
        document.getElementById('btnStopDraw').disabled = true;
        document.getElementById('btnRedraw').disabled = true;

        let countdownVal = 3;

        const runCountdownTick = () => {
            if (countdownVal > 0) {
                // Putar suara countdown
                playSound('countdown');
                // Tampilkan di list rolling lokal
                const list = document.getElementById('rollingList');
                if (list) {
                    list.innerHTML = `
                        <div class="rolling-item font-outfit text-center" style="font-size: 8rem; font-weight: 900; color: #D4AF37; text-shadow: 0 0 30px rgba(212,175,55,0.6); animation: zoomIn 0.3s ease;">
                            ${countdownVal}
                        </div>
                    `;
                }
                // Kirim ke display layar TV
                broadcastToDisplay('COUNTDOWN', { value: countdownVal });

                countdownVal--;
                setTimeout(runCountdownTick, 1000);
            } else {
                // Selesai hitungan mundur, mulai pengundian
                broadcastToDisplay('COUNTDOWN_END', {});

                isDrawing = true;
                document.getElementById('btnStopDraw').disabled = false;

                // Cek apakah ada pemenang khusus yang disetting untuk hadiah ini
                const specialWinnerSetting = state.specialWinners ? state.specialWinners.find(sw => sw.prizeId == selectedPrize.id) : null;
                let foundSpecialWinner = null;
                if (specialWinnerSetting) {
                    foundSpecialWinner = readyParticipants.find(p => p.id == specialWinnerSetting.participantId);
                }

                if (foundSpecialWinner) {
                    targetWinner = foundSpecialWinner;
                } else {
                    const randIndex = Math.floor(Math.random() * readyParticipants.length);
                    targetWinner = readyParticipants[randIndex];
                }

                if (state.settings.drawMode === 'rolling') {
                    startRollingAnimation();
                } else {
                    startWheelAnimation();
                }

                // Pemicu timer Auto Stop jika aktif
                const chkAutoStop = document.getElementById('chkAutoStop');
                if (chkAutoStop && chkAutoStop.checked) {
                    const durationVal = parseInt(document.getElementById('drawDurationInput').value) || 5;
                    setTimeout(() => {
                        if (isDrawing) stopDrawSequence();
                    }, durationVal * 1000);
                }
            }
        };

        runCountdownTick();
    }

    function startRollingAnimation() {
        const list = document.getElementById('rollingList');
        let idx = 0;
        
        let interval = 70;
        if (state.settings.drawSpeed === 'fast') interval = 40;
        else if (state.settings.drawSpeed === 'slow') interval = 120;

        rollTimer = setInterval(() => {
            const item = readyParticipants[idx % readyParticipants.length];
            const html = `
                <div class="rolling-item">
                    <div>${item.nama}</div>
                    <div class="instansi">${item.instansi}</div>
                    <small style="font-size:1rem;">Nomor: ${item.noPeserta}</small>
                </div>
            `;
            list.innerHTML = html;
            // Broadcast rolling tick to display window
            broadcastToDisplay('ROLLING_TICK', item);
            playSound('tick');
            idx++;
        }, interval);
    }

    function startWheelAnimation() {
        let speed = 0.2;
        if (state.settings.drawSpeed === 'fast') speed = 0.35;
        else if (state.settings.drawSpeed === 'slow') speed = 0.1;
        
        wheelSpeed = speed;
        broadcastToDisplay('START_WHEEL', {});
        function animate() {
            if (!isDrawing) return;
            wheelAngle += wheelSpeed;
            const canvas = document.getElementById('wheelCanvas');
            if (canvas) {
                canvas.style.transform = `rotate(${wheelAngle}rad)`;
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    function stopDrawSequence() {
        if (!isDrawing) return;
        isDrawing = false;
        clearInterval(rollTimer);
        document.getElementById('btnStopDraw').disabled = true;
        document.getElementById('btnRedraw').disabled = false;

        // Reveal selected winner card with full animation
        const winner = targetWinner;
        const winHtml = `
            <div class="rolling-item animate__animated animate__zoomIn text-gold" style="font-size:2.6rem;">
                <div>${winner.nama}</div>
                <div class="instansi text-white">${winner.instansi}</div>
                <div class="badge bg-gold text-dark mt-2" style="font-size:1.2rem;">NO. PESERTA: ${winner.noPeserta}</div>
            </div>
        `;
        document.getElementById('rollingList').innerHTML = winHtml;

        // Broadcast winner to display window
        broadcastToDisplay('WINNER', {
            nama:     winner.nama,
            noPeserta: winner.noPeserta,
            instansi: winner.instansi,
            hadiah:   selectedPrize.nama
        });

        // Sound effects
        playSound('fanfare');

        // Confetti
        if (state.settings.animEnabled) {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
            });
        }

        // Save Winner
        const dateStr = new Date().toLocaleString('id-ID');
        state.pemenang.push({
            no: state.pemenang.length + 1,
            nama: winner.nama,
            noPeserta: winner.noPeserta,
            instansi: winner.instansi,
            hadiah: selectedPrize.nama,
            waktu: dateStr
        });

        // Reduce prize qty
        if (state.settings.autoReducePrize && selectedPrize.sisa > 0) {
            selectedPrize.sisa--;
        }

        saveState();
        initApp();

        // Celebration dialog
        Swal.fire({
            title: 'PEMENANG DOORPRIZE!',
            html: `
                <h2 class="text-gold fw-bold">${winner.nama}</h2>
                <h5>No. Peserta: ${winner.noPeserta}</h5>
                <p class="m-0">${winner.instansi}</p>
                <hr>
                <p class="text-success fw-bold">Memenangkan: ${selectedPrize.nama}</p>
            `,
            icon: 'success',
            customClass: {
                popup: 'swal2-popup-custom',
                title: 'swal2-title-custom'
            }
        });
    }

    // === LAYAR BESAR — Buka display.html di jendela terpisah ===
    document.getElementById('btnTvMode').addEventListener('click', () => {
        openDisplayWindow();
        Swal.fire({
            title: 'Layar Audience Dibuka!',
            html: 'Jendela <b>display.html</b> telah dibuka.<br>Pindahkan ke monitor/proyektor audience.',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000
        });
    });



    // Tombol RESET — reset display juga
    document.getElementById('btnResetDraw').addEventListener('click', () => {
        broadcastToDisplay('RESET', {});
    });

    // === WINNERS & EXPORTS ===
    function renderWinnersTable() {
        const tbody = document.getElementById('tbodyWinners');
        tbody.innerHTML = '';
        state.pemenang.forEach((w, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td class="fw-bold">${w.nama}</td>
                <td><span class="badge bg-dark">${w.noPeserta}</span></td>
                <td>${w.instansi}</td>
                <td class="text-gold fw-bold">${w.hadiah}</td>
                <td>${w.waktu}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Export Excel
    document.getElementById('btnExportWinnersExcel').addEventListener('click', () => {
        if (state.pemenang.length === 0) {
            Swal.fire('Info', 'Belum ada data pemenang untuk diekspor.', 'info');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(state.pemenang);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pemenang");
        XLSX.writeFile(wb, "Daftar_Pemenang_Doorprize.xlsx");
    });

    // Export PDF
    document.getElementById('btnExportWinnersPdf').addEventListener('click', () => {
        if (state.pemenang.length === 0) {
            Swal.fire('Info', 'Belum ada data pemenang untuk diekspor.', 'info');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFont("Helvetica", "bold");
        doc.text("DAFTAR PEMENANG DOORPRIZE", 14, 20);
        doc.setFontSize(10);
        doc.text(`Acara: ${state.eventConfig.name}`, 14, 27);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 33);
        
        let y = 45;
        doc.setFont("Helvetica", "bold");
        doc.text("No", 14, y);
        doc.text("Nama", 25, y);
        doc.text("No Peserta", 75, y);
        doc.text("Instansi", 105, y);
        doc.text("Hadiah", 145, y);

        doc.setFont("Helvetica", "normal");
        state.pemenang.forEach((w, idx) => {
            y += 8;
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(String(idx + 1), 14, y);
            doc.text(w.nama.substring(0, 20), 25, y);
            doc.text(w.noPeserta, 75, y);
            doc.text(w.instansi.substring(0, 15), 105, y);
            doc.text(w.hadiah.substring(0, 20), 145, y);
        });

        doc.save("Daftar_Pemenang_Doorprize.pdf");
    });

    document.getElementById('btnClearWinners').addEventListener('click', () => {
        Swal.fire({
            title: 'Hapus Semua Riwayat?',
            text: "Riwayat pemenang akan dihapus, tetapi sisa hadiah tidak dipulihkan otomatis.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Kosongkan'
        }).then(res => {
            if (res.isConfirmed) {
                state.pemenang = [];
                saveState();
                initApp();
            }
        });
    });

    // === CONFIGURATION & BACKUP SETTINGS ===
    // Event configurations
    document.getElementById('eventConfigForm').addEventListener('submit', (e) => {
        e.preventDefault();
        state.eventConfig.name = document.getElementById('cfgEventName').value;
        state.eventConfig.slogan = document.getElementById('cfgEventSlogan').value;
        state.eventConfig.org = document.getElementById('cfgEventOrg').value;
        state.eventConfig.date = document.getElementById('cfgEventDate').value;
        state.eventConfig.marqueeText = document.getElementById('cfgEventMarquee').value;
        saveState();
        applyCustomStyling();
        // Sync to display window
        broadcastToDisplay('UPDATE_MARQUEE', state.eventConfig.marqueeText);
        pushStateToDisplay();
        Swal.fire('Sukses', 'Konfigurasi acara berhasil disimpan!', 'success');
    });

    // Volume & toggle controls
    document.getElementById('soundVolume').addEventListener('input', (e) => {
        state.settings.volume = parseFloat(e.target.value);
        saveState();
    });

    document.getElementById('cfgToggleSound').addEventListener('change', (e) => {
        state.settings.soundEnabled = e.target.checked;
        saveState();
    });

    document.getElementById('cfgToggleAnimations').addEventListener('change', (e) => {
        state.settings.animEnabled = e.target.checked;
        saveState();
    });

    document.getElementById('drawSpeedInput').addEventListener('change', (e) => {
        state.settings.drawSpeed = e.target.value;
        saveState();
        broadcastToDisplay('UPDATE_SPEED', { drawSpeed: state.settings.drawSpeed });
    });

    // Logo Upload
    document.getElementById('logoUploadInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Compress logo to max 300px
            compressImage(file, 300, 0.8, (base64Img) => {
                state.settings.logo = base64Img;
                saveState();
                applyCustomStyling();
            });
        }
    });

    // Background Upload
    document.getElementById('bgUploadInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Compress background to max 1200px
            compressImage(file, 1200, 0.85, (base64Img) => {
                state.settings.bg = base64Img;
                saveState();
                applyCustomStyling();
            });
        }
    });

    document.getElementById('btnResetBg').addEventListener('click', () => {
        state.settings.bg = '';
        saveState();
        document.body.style.backgroundImage = '';
        window.location.reload();
    });

    // Backup & Restore
    document.getElementById('btnBackupJson').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `backup_undian_${Date.now()}.json`);
        dlAnchorElem.click();
    });

    document.getElementById('importJsonInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const importedState = JSON.parse(evt.target.result);
                if (importedState.peserta && importedState.hadiah) {
                    state = importedState;
                    saveState();
                    initApp();
                    Swal.fire('Sukses', 'Data berhasil dipulihkan dari file backup!', 'success');
                } else {
                    Swal.fire('Error', 'Format JSON backup tidak valid!', 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Gagal memparsing file JSON!', 'error');
            }
        };
        reader.readAsText(file);
    });

    // --- Admin Credential Settings Handlers ---
    const formUbahKredensial = document.getElementById('formUbahKredensial');
    if (formUbahKredensial) {
        formUbahKredensial.addEventListener('submit', (e) => {
            e.preventDefault();
            const newAdminUser = document.getElementById('newAdminUser').value.trim();
            const newAdminPass = document.getElementById('newAdminPass').value;
            const confirmAdminPass = document.getElementById('confirmAdminPass').value;
            const currentAdminPass = document.getElementById('currentAdminPass').value;
            const currentCreds = getCredentials();

            // Verifikasi password saat ini
            if (currentAdminPass !== currentCreds.password) {
                Swal.fire({
                    title: 'Verifikasi Gagal',
                    text: 'Password saat ini salah!',
                    icon: 'error'
                });
                return;
            }

            // Validasi password baru jika diisi
            if (newAdminPass) {
                if (newAdminPass !== confirmAdminPass) {
                    Swal.fire({
                        title: 'Validasi Gagal',
                        text: 'Password baru dan konfirmasi password tidak cocok!',
                        icon: 'error'
                    });
                    return;
                }
            }

            const finalUser = newAdminUser || currentCreds.username;
            const finalPass = newAdminPass || currentCreds.password;

            saveCredentials(finalUser, finalPass);
            refreshCredentialUI();
            formUbahKredensial.reset();

            Swal.fire({
                title: 'Berhasil',
                text: 'Kredensial admin berhasil diperbarui!',
                icon: 'success'
            });
        });
    }

    const btnResetKredensial = document.getElementById('btnResetKredensial');
    if (btnResetKredensial) {
        btnResetKredensial.addEventListener('click', () => {
            Swal.fire({
                title: 'Reset Kredensial?',
                text: 'Username akan dikembalikan ke "admin" dan Password ke "admin123". Apakah Anda yakin?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Ya, Reset',
                cancelButtonText: 'Batal'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem(CRED_KEY);
                    refreshCredentialUI();
                    if (formUbahKredensial) formUbahKredensial.reset();
                    Swal.fire('Berhasil', 'Kredensial admin telah dikembalikan ke default.', 'success');
                }
            });
        });
    }

    // Toggle Password Visibility
    const setupPasswordToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.addEventListener('click', () => {
                const isPassword = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPassword ? 'text' : 'password');
                const icon = btn.querySelector('i');
                if (icon) {
                    if (isPassword) {
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    } else {
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                }
            });
        }
    };
    setupPasswordToggle('toggleNewPass', 'newAdminPass');
    setupPasswordToggle('toggleCurrentPass', 'currentAdminPass');

    // --- Special Winners (Targeted Draw) Logic ---
    function populateSpecialWinnerDropdowns() {
        const selectPrize = document.getElementById('selectSpecialPrize');
        const selectParticipant = document.getElementById('selectSpecialParticipant');
        if (!selectPrize || !selectParticipant) return;

        const prevPrizeVal = selectPrize.value;
        const prevParticipantVal = selectParticipant.value;

        selectPrize.innerHTML = '<option value="">-- Pilih Hadiah --</option>';
        state.hadiah.forEach(h => {
            selectPrize.innerHTML += `<option value="${h.id}">${h.nama} (${h.tingkat}) - Sisa: ${h.sisa}</option>`;
        });

        selectParticipant.innerHTML = '<option value="">-- Pilih Peserta --</option>';
        const sortedPeserta = [...state.peserta].sort((a, b) => a.nama.localeCompare(b.nama));
        sortedPeserta.forEach(p => {
            selectParticipant.innerHTML += `<option value="${p.id}">${p.nama} (${p.noPeserta}) - ${p.instansi}</option>`;
        });

        selectPrize.value = prevPrizeVal;
        selectParticipant.value = prevParticipantVal;
    }

    function renderSpecialWinnersTable() {
        const tbody = document.getElementById('tbodySpecialWinners');
        if (!tbody) return;
        tbody.innerHTML = '';

        const list = state.specialWinners || [];
        list.forEach((sw, idx) => {
            const prize = state.hadiah.find(h => h.id == sw.prizeId);
            const participant = state.peserta.find(p => p.id == sw.participantId);

            if (!prize || !participant) return;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td class="fw-bold text-gold">${prize.nama}</td>
                <td><span class="badge bg-primary">${prize.tingkat}</span></td>
                <td class="fw-bold">${participant.nama}</td>
                <td><span class="badge bg-dark">${participant.noPeserta}</span></td>
                <td>${participant.instansi}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger btn-del-special-winner" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-del-special-winner').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                Swal.fire({
                    title: 'Hapus Pemenang Khusus?',
                    text: "Pengaturan pemenang khusus untuk hadiah ini akan dihapus!",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Hapus'
                }).then(res => {
                    if (res.isConfirmed) {
                        state.specialWinners.splice(idx, 1);
                        saveState();
                        initApp();
                    }
                });
            });
        });
    }

    const formTambahPemenangKhusus = document.getElementById('formTambahPemenangKhusus');
    if (formTambahPemenangKhusus) {
        formTambahPemenangKhusus.addEventListener('submit', (e) => {
            e.preventDefault();
            const prizeId = document.getElementById('selectSpecialPrize').value;
            const participantId = document.getElementById('selectSpecialParticipant').value;

            if (!prizeId || !participantId) return;

            const existingIdx = state.specialWinners.findIndex(sw => sw.prizeId == prizeId);
            if (existingIdx !== -1) {
                Swal.fire({
                    title: 'Pemenang Khusus Sudah Ada',
                    text: 'Hadiah ini sudah memiliki setingan pemenang khusus. Apakah Anda ingin menimpanya?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Ya, Timpa',
                    cancelButtonText: 'Batal'
                }).then(res => {
                    if (res.isConfirmed) {
                        state.specialWinners[existingIdx].participantId = participantId;
                        saveState();
                        initApp();
                        formTambahPemenangKhusus.reset();
                        Swal.fire('Berhasil', 'Pengaturan pemenang khusus berhasil diperbarui!', 'success');
                    }
                });
            } else {
                state.specialWinners.push({ prizeId, participantId });
                saveState();
                initApp();
                formTambahPemenangKhusus.reset();
                Swal.fire('Berhasil', 'Pengaturan pemenang khusus berhasil disimpan!', 'success');
            }
        });
    }

    // === START POINT ===
    checkLogin();
});
