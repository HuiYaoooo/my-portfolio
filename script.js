document.addEventListener('DOMContentLoaded', () => {
    
    // 导航栏滚动高亮
    const sections = document.querySelectorAll('section');
    const navItems = document.querySelectorAll('.nav-item');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollY >= (sectionTop - sectionHeight / 3)) {
                current = section.getAttribute('id');
            }
        });
        navItems.forEach(li => {
            li.classList.remove('active');
            if (li.getAttribute('href').includes(current)) {
                li.classList.add('active');
            }
        });
    });

    // --- 简单的图片切换逻辑 (No Libraries) ---

    // 核心切换函数
    window.changeSlide = function(sliderId, direction, pageNumId) {
        const slider = document.getElementById(sliderId);
        const slides = slider.getElementsByClassName('slide');
        let activeIndex = -1;

        // 找到当前显示的图片索引
        for (let i = 0; i < slides.length; i++) {
            if (slides[i].classList.contains('active')) {
                activeIndex = i;
                break;
            }
        }

        // 计算下一张的索引
        let newIndex = activeIndex + direction;

        // 边界检查：如果超出范围，就不动（或者循环，这里是不循环）
        if (newIndex < 0) return; // 到第一页了
        if (newIndex >= slides.length) return; // 到最后一页了

        // 切换 Active 类
        slides[activeIndex].classList.remove('active');
        slides[newIndex].classList.add('active');

        // 更新页码文字
        const indicator = document.getElementById(pageNumId);
        if (indicator) {
            indicator.innerText = (newIndex + 1) + " / " + slides.length;
        }
    }

    // Overlay 开关
    window.openOverlay = function(id) {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    window.closeOverlay = function(id) {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // 链接平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#blog') return; 

            const targetElement = document.querySelector(targetId);
            if(targetElement){
                const headerOffset = window.innerHeight * 0.0625; 
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            }
        });
    });
});