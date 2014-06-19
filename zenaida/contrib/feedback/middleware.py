import re

from django.conf import settings
from django.utils.encoding import force_text

from zenaida.contrib.feedback.settings import CONFIG
from zenaida.contrib.feedback.utils import render_feedback_widget

_HTML_TYPES = ('text/html', 'application/xhtml+xml')

class FeedbackMiddleware(object):
    """
    Middleware to attach the feedback form to all HTML responses.

    """

    def process_response(self, request, response):
        "Inject the feedback form into the response."

        # Currently feedback can only be submitted when logged in.
        if not request.user.is_authenticated():
            return response

        # Check for responses where the feedback can't be inserted.
        content_encoding = response.get('Content-Encoding', '')
        content_type = response.get('Content-Type', '').split(';')[0]
        if any((getattr(response, 'streaming', False),
                'gzip' in content_encoding,
                content_type not in _HTML_TYPES)):
            return response

        content = force_text(response.content, encoding=settings.DEFAULT_CHARSET)
        insert_before = CONFIG['INSERT_BEFORE']
        pattern = re.escape(insert_before)
        bits = re.split(pattern, content, flags=re.IGNORECASE)
        if len(bits) > 1:
            bits[-2] += render_feedback_widget(request)
            response.content = insert_before.join(bits)
            if response.get('Content-Length', None):
                response['Content-Length'] = len(response.content)
        return response