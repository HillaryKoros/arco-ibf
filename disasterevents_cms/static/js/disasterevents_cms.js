// E4DRR Disaster Events CMS — global JS
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.navbar-burger').forEach(function(el) {
        el.addEventListener('click', function() {
            var target = document.getElementById(el.dataset.target);
            el.classList.toggle('is-active');
            target.classList.toggle('is-active');
        });
    });
});
