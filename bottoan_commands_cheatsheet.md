# 📖 BẢNG TRA CỨU TOÀN BỘ CÚ PHÁP LỆNH BOTTOAN

Dưới đây là danh sách đầy đủ tất cả các cách gọi lệnh của BotToan, được phân loại chi tiết theo từng nhóm chức năng. Tất cả các lệnh đều yêu cầu **Tag Bot** ở đầu (ví dụ: `@BotToan diem danh`).

---

## 🏦 1. HỆ THỐNG VÍ TIỀN & NGÂN HÀNG (QUẢN LÝ TÀI CHÍNH)

| Chức năng chính | Cú pháp cách gọi | Kết quả / Mô tả chi tiết |
| :--- | :--- | :--- |
| **Điểm danh** | `@BotToan diem danh`<br>`@BotToan daily` | Nhận ngẫu nhiên từ `10k` đến `50k` mỗi ngày. Cộng thêm bonus chuỗi liên tiếp (streak) tối đa `25k` từ ngày thứ 5. Tự động trích `20% - 30%` trả nợ nếu đang nợ ngân hàng. Reset lúc 00:00 (UTC+7). |
| **Xem tài sản** | `@BotToan vi`<br>`@BotToan tai san`<br>`@BotToan vi tien`<br>`@BotToan check tien`<br>`@BotToan bop tien` | Xem ví & số nợ hiện tại.<br>• **Chat thường:** Hiện tài sản toàn server.<br>• **Kênh thoại:** Quét nhanh và chỉ hiển thị ví của những người ngồi chung phòng voice với bạn. |
| **Xếp hạng** | `@BotToan bxh`<br>`@BotToan top` | Hiển thị Top 5 Đại gia giàu nhất và Top 5 Cái bang nghèo/nợ nhiều nhất Server. |
| **Vay tiền** | `@BotToan vay tien`<br>`@BotToan vay ngan hang`<br>`@BotToan vay no` | Ngân hàng BotToan cấp ngay khoản nợ `100k` vào ví làm vốn cứu sinh. Điều kiện: Chỉ cho vay khi ví hiện tại dưới `10k`. |
| **Trả nợ** | `@BotToan tra no [số tiền]`<br>`@BotToan pay debt [số tiền]`<br>`@BotToan tra no het`<br>`@BotToan tra no all` | Thanh toán nợ nần cho ngân hàng. Phải sạch nợ (`nợ = 0`) mới được tham gia chơi các sòng bạc. |
| **Bùng nợ** | `@BotToan bung no`<br>`@BotToan giat no`<br>`@BotToan tron no` | Trốn nợ ngân hàng (Tỉ lệ 50/50):<br>• **Thành công (50%):** Xóa `30% - 50%` nợ hiện tại (hoặc xóa sạch nếu nợ < 100k).<br>• **Thất bại (50%):** Bị giang hồ tóm phạt nhân 1.5 lần nợ, cấm chat 3 phút và tống vào phòng voice Nhà Tù.<br>• Giới hạn 1 lần/ngày. Không cho bùng nếu nợ $\ge$ 500k. |
| **Chuyển tiền** | `@BotToan chuyen @User [số]`<br>`@BotToan pay @User [số]` | Chuyển khoản ví cá nhân cho người chơi khác (Hỗ trợ viết tắt kiểu `20k`, `1.5tr`, `1.5m`, `1.5trieu`, `1ty`). |

---

## 🎰 2. CÁC TRÒ CHƠI CASINO ĐỎ ĐEN (Tương tác nút bấm)

| Trò chơi | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Tài Xỉu** | `@BotToan tai xiu`<br>`@BotToan tx` | Mini-game Tài Xỉu bằng nút bấm: cược từ `10k` đến `50k` mỗi click. Lắc 3 xí ngầu. Tổng 4-10 là Xỉu, 11-17 là Tài. Bộ ba đồng nhất (3 xúc xắc giống nhau) thì nhà cái ăn sạch. |
| **Bầu Cua** | `@BotToan bau cua` | Sòng Bầu Cua Tôm Cá Hoàng Gia: Cược tối đa 3 linh vật/ván, mức cược từ `10k` đến `50k` mỗi click. Nhấn "Mở bát" để lắc. Nhấn "Hủy cược" hoặc "Nghỉ chơi" để chốt lời. |
| **Xóc Đĩa** | `@BotToan xoc dia` | Sòng Xóc Đĩa ASCII: Chọn cược Chẵn hoặc Lẻ, tiền cược `10k` đến `50k`. Hiệu ứng xóc đĩa cọc cạch trong 3 giây trước khi mở bát. Tỉ lệ ăn 1:1. |
| **Blackjack** | `@BotToan xi dach`<br>`@BotToan blackjack` | Bàn chơi Xì Dách: Trả phí cược cố định `20k`. Người chơi và nhà cái được chia 2 lá bài. Chọn Rút bài (Hit) hoặc Dằn bài (Stand). So điểm trực tiếp với Dealer BotToan (Dealer buộc rút dưới 17 điểm). Blackjack ăn ngay lập tức. |

---

## 👥 3. GAME ĐỒNG ĐỘI & ĐỘT KÍCH SWAT (Tương tác cộng đồng)

| Lệnh game | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Lì xì giật** | `@BotToan lixi [tiền] [người]`<br>`@BotToan li xi [tiền] [người]` | Đại gia bỏ ra số tiền [tiền] để chia nhỏ ngẫu nhiên cho [người] giật nhanh nhất. Sau 3 phút tiền thừa tự động hoàn trả. Vinh danh "Bàn tay vàng" (giật nhiều nhất) và "Bàn tay thối" (giật ít nhất). |
| **Bắn súng xoay** | `@BotToan roulette [tiền]`<br>`@BotToan tu than [tiền]` | Vòng quay tử thần (Russian Roulette): Cần 2 - 6 người tham gia cùng góp hũ cược. Súng lục 6 ổ (1 viên đạn thật). Lần lượt bóp cò, ai dính đạn nổ sọ sẽ bị cấm chat 3 phút, đưa vào voice Nhà Tù, mất tiền cược. Người sống sót chia đều hũ cược. |
| **Poker tử thần** | `@BotToan poker [tiền]`<br>`@BotToan poker roulette`<br>`@BotToan roulette poker` | Sòng Poker tử thần kết hợp đấu súng. Mỗi người nhận 2 lá bài tẩy bí mật. Trải qua các vòng bốc bài chung, người chơi có thể Theo bài (nạp đạn vào súng) hoặc Bỏ bài (bóp cò tự sát với tỉ lệ súng nổ tăng dần). Kẻ thua ở Showdown buộc bóp cò súng nạp 5 viên đạn (tỉ lệ chết 83.33%). |
| **Báo án SWAT** | `@BotToan bao cong an @User`<br>`@BotToan goi cong an @User`<br>`@BotToan bao an @User`<br>`@BotToan snitch @User` | Báo án đột kích bắt quả tang sới bạc:<br>• **Yêu cầu:** Đối phương phải đang trong sới bạc (nằm trong game đang chạy) và ví đối phương $\ge$ 15k. Người báo chưa dùng lượt hôm nay.<br>• **Thành công (50%):** SWAT bắt quả tang đối phương, tịch thu `15k - 30k` từ ví đối phương thưởng cho người báo. Đối phương bị cấm chat 2 phút và bị áp giải vào voice Nhà Tù.<br>• **Thất bại (50%):** Người báo bị phạt `15k`, cấm chat 2 phút và đi tù vì tội báo án láo, trêu chiến sĩ. Giới hạn 1 lần/ngày. |

---

## 🎟️ 4. XỔ SỐ KIẾN THIẾT HÀNG NGÀY (Quay số tự động 18:30)

| Lệnh xổ số | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Mua vé số** | `@BotToan mua ve [số / random]`<br>`@BotToan buy ticket` | Mua vé số kiến thiết: Lệ phí `10k`/vé. Mua tối đa 5 vé/ngày. Có thể chọn số từ `00` đến `99` hoặc nhập `random`. Phí mua vé được cộng dồn trực tiếp vào hũ Jackpot tích lũy. |
| **Xem vé của tôi** | `@BotToan ve so`<br>`@BotToan check ve`<br>`@BotToan xem ve`<br>`@BotToan jackpot` | Kiểm tra thông tin xổ số: Hiển thị tổng hũ Jackpot hiện tại, danh sách các vé bạn đã mua hôm nay và kết quả trúng thưởng đợt quay trước. |
| **Xem kết quả** | `@BotToan kqxs`<br>`@BotToan ket qua xo so`<br>`@BotToan xo so`<br>`@BotToan kq ve so` | Xem bảng vàng kết quả kì quay thưởng gần nhất lúc 18:30. Nếu không ai trúng Jackpot, hũ tiền sẽ được cộng dồn (Rollover) sang ngày tiếp theo. |

---

## 🎮 5. VALORANT TRACKER, DRAFT & TÒA ÁN GAMING

| Chức năng Valorant | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Đăng ký Riot ID** | `@BotToan reg val [Tên#Tag]` | Liên kết tài khoản Riot ID để tra cứu nhanh cho những lần sau mà không cần gõ lại Tên#Tag. |
| **Xem rank** | `@BotToan rank val [Tên#Tag]`<br>`@BotToan rank valorant`<br>`@BotToan rank val` | Tra cứu rank xếp hạng hiện tại thực tế qua API (cào dữ liệu trực tiếp, hiển thị icon hạng, ELO, chênh lệch RR trận gần nhất và rank cao nhất từng đạt được). |
| **Draft đội hình** | `@BotToan pick tuong`<br>`@BotToan chon tuong`<br>`@BotToan quay tuong`<br>`@BotToan random tuong` | Tạo phòng chờ draft tối đa 5 người. Mỗi người lần lượt chọn hệ tướng muốn quay (Duelist, Initiator, Controller, Sentinel hoặc Random). Bot chạy hiệu ứng quay tướng 1.5s, người chơi có 15s để Chốt hoặc Đổi tướng (đổi 1 lần). Kết thúc, Gemini AI sẽ tự động nhảy vào **Đánh giá đội hình** và khịa chiến thuật cực mạnh! |
| **Tòa án Gaming** | `@BotToan toaan @User`<br>`@BotToan lt @User`<br>`@BotToan luan toi @User` | Kết tội và phán xét "độ báo thủ" của bạn bè dựa trên game đang chơi (Playing/Streaming/Competing) và thời gian cày cuốc thực tế, đồng bộ giới tính từ DB để khịa mỏ hỗn với hình phạt vô tri và thanh tiến trình `P_BAR` từ Gemini. |

---

## 🌸 6. GÓC CHỊ EM PHỤ NỮ (VIRAL FEATURES)

| Lệnh chị em | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Bói màu vận khí** | `@BotToan aura`<br>`@BotToan mau van khi`<br>`@BotToan sac mau hom nay` | Phân tích màu sắc hào quang và năng lượng may mắn của ngày hôm nay. |
| **Hộp thư bí mật** | `@BotToan thu bi mat`<br>`@BotToan anonymous`<br>`@BotToan anon` | Gửi thư ẩn danh qua DM cho Bot. Bot sẽ giữ bí mật danh tính người gửi, đưa thư vào hàng đợi duyệt công khai. |
| **Duyệt thư hàng đợi** | `@BotToan checkdm`<br>`@BotToan check dm`<br>`@BotToan kiem tra thu` | Hiển thị danh sách các thư ẩn danh đang chờ duyệt để đưa lên kênh chat chung. |
| **Nhật ký tâm trạng** | `@BotToan tam trang`<br>`@BotToan mood`<br>`@BotToan cam xuc` | Nhật ký tâm trạng hàng ngày, cộng dồn streak ghi chép và nhận lời khuyên Tarot dịu dàng từ AI. |
| **Biên niên sử Overthink** | `@BotToan overthink [tình huống]` | AI phân tích một tình huống hay tin nhắn của crush thành 3 cấp độ: *Thực tế*, *Drama Hàn Quốc*, và *Thuyết âm mưu đa vũ trụ* kèm lời khuyên bớt điên. |
| **Chốt đơn quyết đoán** | `@BotToan chotdon [món đồ] [giá]`<br>`@BotToan mua hay khong`<br>`@BotToan tieu hay cat` | Đổ xúc xắc tâm linh và bắt Gemini đưa ra phán quyết **CHỐT** (phá sản) hoặc **CẤT** (giữ ví) kèm chỉ số hối hận dự kiến. |
| **Hôm nay em là ai** | `@BotToan style`<br>`@BotToan hom nay em la ai` | Tra cứu hình tượng vibe/aesthetic hôm nay của bạn (Matcha Girl, Drama Queen, CEO Overnight...) kèm phụ kiện, nhạc nền và trích dẫn đặc trưng. |
| **Máy dò Gu Đa Vũ Trụ** | `@BotToan mygu`<br>`@BotToan gu` | Trắc nghiệm 6 câu hỏi vạch trần gu người yêu lý tưởng và chẩn đoán bệnh lý lụy tình. (Có ngoại lệ ẩn cho admin). |
| **Quét Gu Vũ Trụ** | `@BotToan doan mygu`<br>`@BotToan doan gu` | Bói nhanh gu người yêu hôm nay bằng quét radar sóng não ngẫu nhiên theo ngày (chiều cao, mỏ hỗn, chung thủy, tọa độ). |
| **So gu đối phương** | `@BotToan mygu match @User` | So khớp gu mong muốn của bạn với profile giới tính/ngày sinh thực tế của đối phương xem có lệch sóng không. |
| **Danh sách bang hội** | `@BotToan mygu list`<br>`@BotToan mygu top` | Bảng vàng gom nhóm toàn bộ thành viên server vào các bang hội vô tri: *Hội Nghiện Ăn Chửi*, *Hội Thèm Tiền*, *Hội Cá Ươn*, *Gia Tộc Overthink*. |

---

## 🔮 7. TÂM LINH & GHÉP ĐÔI TÌNH DUYÊN

| Lệnh tâm linh | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Bói Tarot** | `@BotToan boi tarot`<br>`@BotToan tarot`<br>`@BotToan xem tarot`<br>`@BotToan trai bai tarot`<br>`@BotToan xem boi tarot` | Rút lá bài Tarot định mệnh ngày hôm nay. |
| **Gieo quẻ** | `@BotToan gieo que`<br>`@BotToan xin que` | Xin quẻ xăm tâm linh hàng ngày. |
| **Khai báo Crush** | `@BotToan crush`<br>`@BotToan thich` | Đăng ký thầm thương trộm nhớ một người trong server (hoàn toàn bí mật). |
| **Ghép đôi** | `@BotToan ghep doi`<br>`@BotToan ghep cap`<br>`@BotToan ghep` | Ghép đôi ngẫu nhiên 2 người dùng trong server để bói duyên nợ. |
| **Thuê thám tử** | `@BotToan tham tu`<br>`@BotToan thue tham tu` | Trả phí `30k` để điều tra xem có ai đang thầm thương trộm nhớ (crush) mình không. |
| **Bán đứng đồng bọn** | `@BotToan ban dung`<br>`@BotToan mua tin`<br>`@BotToan chi mat` | Trả phí `20k` để hỏi xem một người cụ thể đang thầm thương trộm nhớ ai. |
| **Bùa yêu** | `@BotToan mua bua`<br>`@BotToan ep duyen`<br>`@BotToan bua yeu` | Trả phí `50k` để dán bùa yêu lên crush, tăng mạnh tỉ lệ ghép đôi thành công với họ khi dùng lệnh ghép đôi. |

---

## 🗣️ 8. CHAT AI & VOICE HORN-BOT (Tiện ích)

| Lệnh tiện ích | Cú pháp cách gọi | Quy tắc & Kết quả |
| :--- | :--- | :--- |
| **Chat với BotToan** | `@BotToan [nội dung tự do]` | Trò chuyện tự do với Gemini AI mỏ hỗn. Có bộ nhớ lưu trữ lịch sử 10 câu chat gần nhất. |
| **Cấm nói Horn-Bot** | `@BotToan cam mom`<br>`@BotToan im di`<br>`@BotToan cam`<br>`@BotToan im mom`<br>`@BotToan nin`<br>`@BotToan ngung sua` | Kích hoạt cấm khẩu: Ngay lập tức ngắt kết nối hoặc cách ly bot phát nhạc chào mừng Horn-Bot ra khỏi phòng voice hiện tại (chỉ hoạt động khi Horn-Bot và người ra lệnh ở chung phòng voice). |
| **Dọn dẹp tin nhắn** | `@BotToan xoa [số]`<br>`@BotToan xoa all` | Xóa nhanh tin nhắn rác trong kênh (mặc định xóa 100 tin gần nhất, bỏ qua tin nhắn ghim, lọc được tin nhắn của bot hoặc user). |
